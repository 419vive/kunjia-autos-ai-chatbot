import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Notification Recipients", () => {
  const originalEnv = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS = originalEnv;
    } else {
      delete process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
    }
  });

  it("should have LINE_ADDITIONAL_NOTIFY_USER_IDS env set", () => {
    // Restore original env for this test
    process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS = originalEnv;
    const val = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(0);
    // Should contain a valid LINE User ID format (starts with U, 33 chars)
    const ids = val!.split(",").map((id) => id.trim());
    for (const id of ids) {
      expect(id).toMatch(/^U[a-f0-9]{32}$/);
    }
  });

  it("should build correct recipient list with owner + additional IDs", () => {
    process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS =
      "U1587445f622aeb76945e88bbb195ff39";
    const ownerUserId = "U5591c54539693c8b5d815e179e6f300d";

    const recipientIds: string[] = [];
    if (ownerUserId) recipientIds.push(ownerUserId);

    const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
    if (additionalIds) {
      const extras = additionalIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      for (const extraId of extras) {
        if (!recipientIds.includes(extraId)) {
          recipientIds.push(extraId);
        }
      }
    }

    expect(recipientIds).toHaveLength(2);
    expect(recipientIds[0]).toBe("U5591c54539693c8b5d815e179e6f300d"); // owner
    expect(recipientIds[1]).toBe("U1587445f622aeb76945e88bbb195ff39"); // Megan
  });

  it("should not duplicate if owner is also in additional IDs", () => {
    const ownerUserId = "U5591c54539693c8b5d815e179e6f300d";
    process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS = ownerUserId; // same as owner

    const recipientIds: string[] = [];
    if (ownerUserId) recipientIds.push(ownerUserId);

    const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
    if (additionalIds) {
      const extras = additionalIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      for (const extraId of extras) {
        if (!recipientIds.includes(extraId)) {
          recipientIds.push(extraId);
        }
      }
    }

    expect(recipientIds).toHaveLength(1); // no duplicates
  });

  it("should handle multiple comma-separated additional IDs", () => {
    process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS =
      "U1587445f622aeb76945e88bbb195ff39, Uabcdef1234567890abcdef1234567890";
    const ownerUserId = "U5591c54539693c8b5d815e179e6f300d";

    const recipientIds: string[] = [];
    if (ownerUserId) recipientIds.push(ownerUserId);

    const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
    if (additionalIds) {
      const extras = additionalIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      for (const extraId of extras) {
        if (!recipientIds.includes(extraId)) {
          recipientIds.push(extraId);
        }
      }
    }

    expect(recipientIds).toHaveLength(3);
  });

  it("should handle empty additional IDs gracefully", () => {
    process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS = "";
    const ownerUserId = "U5591c54539693c8b5d815e179e6f300d";

    const recipientIds: string[] = [];
    if (ownerUserId) recipientIds.push(ownerUserId);

    const additionalIds = process.env.LINE_ADDITIONAL_NOTIFY_USER_IDS;
    if (additionalIds) {
      const extras = additionalIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      for (const extraId of extras) {
        if (!recipientIds.includes(extraId)) {
          recipientIds.push(extraId);
        }
      }
    }

    expect(recipientIds).toHaveLength(1); // only owner
  });
});
