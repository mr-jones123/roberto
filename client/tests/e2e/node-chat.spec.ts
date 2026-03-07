import { test, expect, type APIRequestContext } from "@playwright/test";

const API = "http://localhost:3001";

test.describe("node-chat MVP", () => {
  test.describe.configure({ mode: "serial" });

  let token1: string;
  let token2: string;
  let node1Id: string;
  let node2Id: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function ensureSetup(request: APIRequestContext): Promise<void> {
    if (token1) return;

    const r1 = await request.post(`${API}/api/auth/login`, {
      data: { username: "reporter1", password: "pass123" },
    });
    expect(r1.ok()).toBeTruthy();
    token1 = (await r1.json()).token;

    const r2 = await request.post(`${API}/api/auth/login`, {
      data: { username: "reporter2", password: "pass123" },
    });
    expect(r2.ok()).toBeTruthy();
    token2 = (await r2.json()).token;

    const n1 = await request.post(`${API}/api/nodes`, {
      headers: auth(token1),
      data: { latitude: 14.5995, longitude: 120.9842 },
    });
    expect(n1.status()).toBe(201);
    node1Id = (await n1.json()).node.id;

    const n2 = await request.post(`${API}/api/nodes`, {
      headers: auth(token2),
      data: { latitude: 14.6, longitude: 120.98 },
    });
    expect(n2.status()).toBe(201);
    node2Id = (await n2.json()).node.id;
  }

  test("accept flow: invite -> accept -> message exchange", async ({ request }) => {
    await ensureSetup(request);

    // reporter1 sends invite to reporter2's node
    const invRes = await request.post(`${API}/api/invites`, {
      headers: auth(token1),
      data: { recipient_node_id: node2Id },
    });
    expect(invRes.status()).toBe(201);
    const { invite } = await invRes.json();
    expect(invite.status).toBe("pending");
    expect(invite.sender_node_id).toBe(node1Id);
    expect(invite.recipient_node_id).toBe(node2Id);

    // reporter2 accepts
    const acceptRes = await request.patch(`${API}/api/invites/${invite.id}/respond`, {
      headers: auth(token2),
      data: { action: "accepted", version: 1 },
    });
    expect(acceptRes.ok()).toBeTruthy();
    const acceptBody = await acceptRes.json();
    expect(acceptBody.invite.status).toBe("accepted");
    expect(acceptBody.conversation).toBeDefined();
    expect(acceptBody.conversation.id).toBeDefined();
    const convId: string = acceptBody.conversation.id;

    // both users exchange messages
    const msg1Res = await request.post(`${API}/api/conversations/${convId}/messages`, {
      headers: auth(token1),
      data: { client_msg_id: `e2e-accept-${Date.now()}-1`, body: "Hello from reporter1!" },
    });
    expect(msg1Res.status()).toBe(201);
    expect((await msg1Res.json()).message.body).toBe("Hello from reporter1!");

    const msg2Res = await request.post(`${API}/api/conversations/${convId}/messages`, {
      headers: auth(token2),
      data: { client_msg_id: `e2e-accept-${Date.now()}-2`, body: "Hi back from reporter2!" },
    });
    expect(msg2Res.status()).toBe(201);

    // verify both messages are retrievable
    const msgsRes = await request.get(`${API}/api/conversations/${convId}/messages`, {
      headers: auth(token1),
    });
    expect(msgsRes.ok()).toBeTruthy();
    const { messages } = await msgsRes.json();
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const bodies = messages.map((m: { body: string }) => m.body);
    expect(bodies).toContain("Hello from reporter1!");
    expect(bodies).toContain("Hi back from reporter2!");

    // conversation appears in user's list
    const convsRes = await request.get(`${API}/api/conversations`, {
      headers: auth(token1),
    });
    expect(convsRes.ok()).toBeTruthy();
    const { conversations } = await convsRes.json();
    expect(conversations.some((c: { id: string }) => c.id === convId)).toBeTruthy();
  });

  test("reject flow: invite -> reject -> no conversation", async ({ request }) => {
    await ensureSetup(request);

    // reporter1 sends invite to reporter2's node
    const invRes = await request.post(`${API}/api/invites`, {
      headers: auth(token1),
      data: { recipient_node_id: node2Id },
    });
    expect(invRes.status()).toBe(201);
    const { invite } = await invRes.json();
    expect(invite.status).toBe("pending");

    // reporter2 rejects
    const rejectRes = await request.patch(`${API}/api/invites/${invite.id}/respond`, {
      headers: auth(token2),
      data: { action: "rejected", version: 1 },
    });
    expect(rejectRes.ok()).toBeTruthy();
    const rejectBody = await rejectRes.json();
    expect(rejectBody.invite.status).toBe("rejected");
    expect(rejectBody.conversation).toBeUndefined();

    // rejected invite visible in recipient's list
    const invitesRes = await request.get(`${API}/api/invites`, {
      headers: auth(token2),
    });
    expect(invitesRes.ok()).toBeTruthy();
    const { invites } = await invitesRes.json();
    const rejected = invites.find((i: { id: string }) => i.id === invite.id);
    expect(rejected).toBeDefined();
    expect(rejected.status).toBe("rejected");
  });

  test("reconnect catch-up: messages returned since timestamp", async ({ request }) => {
    await ensureSetup(request);

    // record timestamp before creating new data
    const since = new Date().toISOString();

    // create a fresh invite and accept it
    const invRes = await request.post(`${API}/api/invites`, {
      headers: auth(token1),
      data: { recipient_node_id: node2Id },
    });
    expect(invRes.status()).toBe(201);
    const { invite } = await invRes.json();

    const acceptRes = await request.patch(`${API}/api/invites/${invite.id}/respond`, {
      headers: auth(token2),
      data: { action: "accepted", version: 1 },
    });
    expect(acceptRes.ok()).toBeTruthy();
    const convId: string = (await acceptRes.json()).conversation.id;

    // send a message after the recorded timestamp
    const uniqueBody = `catch-up-test-${Date.now()}`;
    const msgRes = await request.post(`${API}/api/conversations/${convId}/messages`, {
      headers: auth(token1),
      data: { client_msg_id: `catchup-${Date.now()}`, body: uniqueBody },
    });
    expect(msgRes.status()).toBe(201);

    // invite catch-up returns the new invite
    const invCatchup = await request.get(
      `${API}/api/invites/catchup?since=${encodeURIComponent(since)}`,
      { headers: auth(token1) },
    );
    expect(invCatchup.ok()).toBeTruthy();
    const { invites } = await invCatchup.json();
    expect(invites.some((i: { id: string }) => i.id === invite.id)).toBeTruthy();

    // conversation catch-up returns the new message
    const msgCatchup = await request.get(
      `${API}/api/conversations/catchup?since=${encodeURIComponent(since)}`,
      { headers: auth(token1) },
    );
    expect(msgCatchup.ok()).toBeTruthy();
    const { messages } = await msgCatchup.json();
    expect(messages.some((m: { body: string }) => m.body === uniqueBody)).toBeTruthy();
  });
});
