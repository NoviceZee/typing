import { describe, expect, it, vi } from "vitest";
import {
  acceptFriendRequest,
  getFriendshipWithProfileHandle,
  listAcceptedFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequestByProfileHandle
} from "./friendStorage";

describe("friendStorage", () => {
  it("sends friend requests by normalized profile handle", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: makeFriendship({ status: "pending" }),
      error: null
    });

    await expect(sendFriendRequestByProfileHandle(" Formal_Typist ", { rpc })).resolves.toMatchObject({
      status: "pending"
    });

    expect(rpc).toHaveBeenCalledWith("send_friend_request_by_handle", { target_handle: "formal_typist" });
  });

  it("rejects invalid handles before sending", async () => {
    const rpc = vi.fn();

    await expect(sendFriendRequestByProfileHandle("no", { rpc })).rejects.toThrow("Handle must be 3-20 characters.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts a pending friend request", async () => {
    const single = vi.fn().mockResolvedValue({
      data: makeFriendship({ status: "accepted" }),
      error: null
    });
    const select = vi.fn(() => ({ single }));
    const eqStatus = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqStatus }));
    const update = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ update }));

    await expect(acceptFriendRequest("friendship-1", { from })).resolves.toMatchObject({ status: "accepted" });

    expect(from).toHaveBeenCalledWith("friendships");
    expect(update).toHaveBeenCalledWith({ status: "accepted" });
    expect(eqId).toHaveBeenCalledWith("id", "friendship-1");
    expect(eqStatus).toHaveBeenCalledWith("status", "pending");
  });

  it("deletes pending requests when rejecting", async () => {
    const eqStatus = vi.fn().mockResolvedValue({ error: null });
    const eqId = vi.fn(() => ({ eq: eqStatus }));
    const remove = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ delete: remove }));

    await expect(rejectFriendRequest("friendship-1", { from })).resolves.toBeUndefined();

    expect(eqStatus).toHaveBeenCalledWith("status", "pending");
  });

  it("deletes accepted friendships when removing friends", async () => {
    const eqStatus = vi.fn().mockResolvedValue({ error: null });
    const eqId = vi.fn(() => ({ eq: eqStatus }));
    const remove = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ delete: remove }));

    await expect(removeFriend("friendship-1", { from })).resolves.toBeUndefined();

    expect(eqStatus).toHaveBeenCalledWith("status", "accepted");
  });

  it("lists incoming, outgoing, and accepted friend records", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [makeFriendListItem({ direction: "incoming" })],
      error: null
    });

    await listIncomingFriendRequests({ rpc });
    await listOutgoingFriendRequests({ rpc });
    await listAcceptedFriends({ rpc });

    expect(rpc).toHaveBeenNthCalledWith(1, "list_friendships", {
      request_direction: "incoming",
      request_status: "pending"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "list_friendships", {
      request_direction: "outgoing",
      request_status: "pending"
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "list_friendships", {
      request_direction: "any",
      request_status: "accepted"
    });
  });

  it("loads the friendship state for a public profile handle", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: makeFriendListItem({ direction: "outgoing" }),
      error: null
    });

    await expect(getFriendshipWithProfileHandle("Formal_Typist", { rpc })).resolves.toMatchObject({
      direction: "outgoing"
    });

    expect(rpc).toHaveBeenCalledWith("get_friendship_with_handle", { target_handle: "formal_typist" });
  });
});

function makeFriendship(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "friendship-1",
    requester_id: "user-1",
    addressee_id: "user-2",
    status: "pending",
    created_at: "2026-06-22T00:00:00.000Z",
    updated_at: "2026-06-22T00:00:00.000Z",
    ...overrides
  };
}

function makeFriendListItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "friendship-1",
    user_id: "user-2",
    handle: "formal_typist",
    status: "pending",
    direction: "incoming",
    created_at: "2026-06-22T00:00:00.000Z",
    updated_at: "2026-06-22T00:00:00.000Z",
    ...overrides
  };
}
