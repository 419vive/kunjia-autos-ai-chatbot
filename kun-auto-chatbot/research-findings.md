# Research: Preventing LLM from Ignoring Long System Prompt Instructions

## Key Techniques Found

### 1. Three-Layer Repetition (Medium article - Lilian Li)
- **Layer 1 (System)**: Detailed rules + complete examples at the beginning
- **Layer 2 (Context)**: Task and data in the middle
- **Layer 3 (User message end)**: Concise format/instruction reminder RIGHT BEFORE output
- "Strategic repetition" - repeat critical rules 3 times across different positions

### 2. Sandwich Prompting (Elastic blog + multiple sources)
- Place critical instructions BOTH at the start AND end of the prompt
- The "bread" (instructions) sandwiches the "filling" (data/context)
- Exploits both Primacy Effect (remember first things) and Recency Effect (remember last things)

### 3. Visual Markers & Priority Signals
- Use ⚠️ MANDATORY, CRITICAL, 🔴 markers for key rules
- Use XML tags to create clear sections: <rules>, <context>, <reminder>
- Bold/caps for absolute requirements

### 4. Context Engineering (Anthropic)
- "Just in time" context loading - don't load everything upfront
- Keep context "informative yet tight"
- Progressive disclosure - only load relevant info when needed
- Metadata and structure help models understand importance

### 5. Two-Pass Architecture
- First pass: Classify the user's intent/question type
- Second pass: Send ONLY the relevant rules for that intent
- Dramatically reduces prompt length for each call

### 6. Multi-Message Approach
- Split system prompt into: system message + assistant prefill + user message
- System: core identity/rules
- User message: inject dynamic context + final instruction reminder
- This creates multiple "attention anchors"

## DESIGN DECISION: Two-Pass + Dynamic Prompt Assembly

### Architecture:
1. **Pre-processing pass** (code, not LLM): Detect intents + vehicle from message
2. **Dynamic prompt assembly**: Based on detected intents, ONLY include relevant sections
3. **Sandwich structure**: Critical rules at start AND end
4. **User message injection**: Final instruction reminder in the last user message

### Benefits:
- Prompt goes from 500+ lines to ~100-150 lines per call
- Only relevant rules are included (no noise)
- Critical instructions are at both start and end (sandwich)
- Intent-specific instructions are injected last (recency effect)
