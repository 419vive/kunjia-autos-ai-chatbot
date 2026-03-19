#!/usr/bin/env python3
"""
Claude Code Hook Handler
=============================================
Handles events from Claude Code and plays sounds for different hook events.
Supports all 22 Claude Code hooks.

Special handling for git commits: plays pretooluse-git-committing sound.

Agent Support:
  Use --agent=<name> to play agent-specific sounds from agent_* folders.
"""

import sys
import json
import subprocess
import re
import platform
import argparse
from pathlib import Path

try:
    import winsound
except ImportError:
    winsound = None

HOOK_SOUND_MAP = {
    "PreToolUse": "pretooluse",
    "PermissionRequest": "permissionrequest",
    "PostToolUse": "posttooluse",
    "PostToolUseFailure": "posttoolusefailure",
    "UserPromptSubmit": "userpromptsubmit",
    "Notification": "notification",
    "Stop": "stop",
    "SubagentStart": "subagentstart",
    "SubagentStop": "subagentstop",
    "PreCompact": "precompact",
    "PostCompact": "postcompact",
    "SessionStart": "sessionstart",
    "SessionEnd": "sessionend",
    "Setup": "setup",
    "TeammateIdle": "teammateidle",
    "TaskCompleted": "taskcompleted",
    "ConfigChange": "configchange",
    "WorktreeCreate": "worktreecreate",
    "WorktreeRemove": "worktreeremove",
    "InstructionsLoaded": "instructionsloaded",
    "Elicitation": "elicitation",
    "ElicitationResult": "elicitationresult"
}

AGENT_HOOK_SOUND_MAP = {
    "PreToolUse": "agent_pretooluse",
    "PostToolUse": "agent_posttooluse",
    "PermissionRequest": "agent_permissionrequest",
    "PostToolUseFailure": "agent_posttoolusefailure",
    "Stop": "agent_stop",
    "SubagentStop": "agent_subagentstop"
}

BASH_PATTERNS = [
    (r'git commit', "pretooluse-git-committing"),
]


def get_audio_player():
    system = platform.system()
    if system == "Darwin":
        return ["afplay"]
    elif system == "Linux":
        players = [
            ["paplay"],
            ["aplay"],
            ["ffplay", "-nodisp", "-autoexit"],
            ["mpg123", "-q"],
        ]
        for player in players:
            try:
                subprocess.run(
                    ["which", player[0]],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=True
                )
                return player
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue
        return None
    elif system == "Windows":
        return ["WINDOWS"]
    else:
        return None


def play_sound(sound_name):
    if "/" in sound_name or "\\" in sound_name or ".." in sound_name:
        print(f"Invalid sound name: {sound_name}", file=sys.stderr)
        return False

    audio_player = get_audio_player()
    if not audio_player:
        return False

    script_dir = Path(__file__).parent
    hooks_dir = script_dir.parent
    folder_name = sound_name.split('-')[0]
    sounds_dir = hooks_dir / "sounds" / folder_name

    is_windows = audio_player[0] == "WINDOWS"
    extensions = ['.wav'] if is_windows else ['.wav', '.mp3']

    for extension in extensions:
        file_path = sounds_dir / f"{sound_name}{extension}"
        if file_path.exists():
            try:
                if is_windows:
                    if winsound:
                        winsound.PlaySound(str(file_path),
                                         winsound.SND_FILENAME | winsound.SND_NODEFAULT)
                        return True
                    else:
                        return False
                else:
                    subprocess.Popen(
                        audio_player + [str(file_path)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True
                    )
                    return True
            except (FileNotFoundError, OSError) as e:
                print(f"Error playing sound {file_path.name}: {e}", file=sys.stderr)
                return False
            except Exception as e:
                print(f"Error playing sound {file_path.name}: {e}", file=sys.stderr)
                return False

    return False


def is_hook_disabled(event_name):
    try:
        script_dir = Path(__file__).parent
        hooks_dir = script_dir.parent
        config_dir = hooks_dir / "config"

        local_config_path = config_dir / "hooks-config.local.json"
        default_config_path = config_dir / "hooks-config.json"
        config_key = f"disable{event_name}Hook"

        local_config = None
        if local_config_path.exists():
            try:
                with open(local_config_path, "r", encoding="utf-8") as f:
                    local_config = json.load(f)
            except Exception:
                pass

        default_config = None
        if default_config_path.exists():
            try:
                with open(default_config_path, "r", encoding="utf-8") as f:
                    default_config = json.load(f)
            except Exception:
                pass

        if local_config is not None and config_key in local_config:
            return local_config[config_key]
        elif default_config is not None and config_key in default_config:
            return default_config[config_key]
        else:
            return False
    except Exception:
        return False


def is_logging_disabled():
    try:
        script_dir = Path(__file__).parent
        hooks_dir = script_dir.parent
        config_dir = hooks_dir / "config"

        local_config_path = config_dir / "hooks-config.local.json"
        default_config_path = config_dir / "hooks-config.json"

        local_config = None
        if local_config_path.exists():
            try:
                with open(local_config_path, "r", encoding="utf-8") as f:
                    local_config = json.load(f)
            except Exception:
                pass

        default_config = None
        if default_config_path.exists():
            try:
                with open(default_config_path, "r", encoding="utf-8") as f:
                    default_config = json.load(f)
            except Exception:
                pass

        if local_config is not None and "disableLogging" in local_config:
            return local_config["disableLogging"]
        elif default_config is not None and "disableLogging" in default_config:
            return default_config["disableLogging"]
        else:
            return False
    except Exception:
        return False


def log_hook_data(hook_data, agent_name=None):
    if is_logging_disabled():
        return
    try:
        script_dir = Path(__file__).parent
        hooks_dir = script_dir.parent
        logs_dir = hooks_dir / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)

        log_entry = hook_data.copy()
        log_entry.pop("transcript_path", None)
        log_entry.pop("cwd", None)
        if agent_name:
            log_entry["invoked_by_agent"] = agent_name

        log_path = logs_dir / "hooks-log.jsonl"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False, indent=2) + "\n")
    except Exception as e:
        print(f"Failed to log hook_data: {e}", file=sys.stderr)


def detect_bash_command_sound(command):
    if not command:
        return None
    for pattern, sound_name in BASH_PATTERNS:
        if re.search(pattern, command.strip()):
            return sound_name
    return None


def get_sound_name(hook_data, agent_name=None):
    event_name = hook_data.get("hook_event_name", "")
    tool_name = hook_data.get("tool_name", "")

    if agent_name:
        return AGENT_HOOK_SOUND_MAP.get(event_name)

    if event_name == "PreToolUse" and tool_name == "Bash":
        tool_input = hook_data.get("tool_input", {})
        command = tool_input.get("command", "")
        special_sound = detect_bash_command_sound(command)
        if special_sound:
            return special_sound

    return HOOK_SOUND_MAP.get(event_name)


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Claude Code Hook Handler - plays sounds for hook events"
    )
    parser.add_argument(
        "--agent",
        type=str,
        default=None,
        help="Agent name for agent-specific sounds"
    )
    return parser.parse_args()


def main():
    try:
        args = parse_arguments()
        stdin_content = sys.stdin.read().strip()

        if not stdin_content:
            sys.exit(0)

        input_data = json.loads(stdin_content)
        log_hook_data(input_data, agent_name=args.agent)

        event_name = input_data.get("hook_event_name", "")
        if not args.agent and is_hook_disabled(event_name):
            sys.exit(0)

        sound_name = get_sound_name(input_data, agent_name=args.agent)
        if sound_name:
            play_sound(sound_name)

        sys.exit(0)

    except json.JSONDecodeError:
        sys.exit(0)
    except Exception:
        sys.exit(0)


if __name__ == "__main__":
    main()
