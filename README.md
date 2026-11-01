# The Apology Tour

A public multiplayer party game for 2–8 creators. Based on the supplied HTML game, preserving its scandal and twist decks, generated avatars, visual styling, and subscriber scoring.

## Run

Requires Node.js 22 or newer. There are no third-party runtime or development dependencies to install.

```sh
node server.js
```

Open http://localhost:3000. Create a room, then join its code from another device or a separately opened browser tab. Player credentials live in tab-scoped sessionStorage and survive page reloads. Use separate tabs opened independently rather than duplicating a signed-in player tab.

```sh
node --test
```

Tests cover two-player full-game progression, scores, private pending votes with three players, duplicate vote rejection, host/performer permissions, invalid sessions, and rematches.

## Play

1. Each creator joins with their own name and avatar. Share the invite link or six-character code.
2. The host selects 1–3 rounds and 45/60/90 seconds, then starts.
3. The active creator draws a scandal and twist, then performs an apology out loud. No audio/video is transmitted or recorded. Remote players should use a separate voice call.
4. Other players submit one private verdict and a twist vote. The server reveals aggregate results after all judges vote.
5. Forgiven earns +150,000 subscribers, Mid +25,000, and Worse −100,000 per judge. A strict majority voting that the twist was nailed adds +75,000. A redraw costs 50,000. Everyone starts at 1,000,000.
6. The host advances through every creator. Highest final score wins; ties are shared.

## Deploy with GitHub and Render

Upload this directory as a GitHub repository. The repository root must contain package.json and server.js.

In Render, create a Web Service from that repository:

- Runtime: Node
- Build command: `node --check server.js`
- Start command: `node server.js`
- Instance type: Free
- Health check: `/health`
- Root directory: blank

Alternatively, create a Render Blueprint from the included render.yaml, which explicitly selects the free plan. No database, secrets, API keys, or paid add-ons are needed. Render provides PORT automatically; the server binds to 0.0.0.0.

## Hosting behavior

The server uses same-origin HTTP requests, polling once per second for synchronized state. Votes, permissions, timers, and scores are controlled by the server, not trusted from browsers. Individual vote choices are returned only to the player who cast them; other players receive completion status and aggregate results.

Rooms reside in one process's memory. Use one Render instance. Rooms reset on restart, redeploy, or free-service spin-down; abandoned rooms expire after six hours without activity. Free Render services sleep after 15 minutes with no inbound traffic, and the next visit can take about a minute to wake the server. Reload restores a player's identity while their room still exists. A player who closes their tab or clears its storage may lose access to that seat. All joined judges must vote before results appear.

## Verification completed locally

- `node --check` passed for server.js, public/app.js, and public/assets.js.
- `node --test` passed both multiplayer integration tests.
- Two independent browser tabs joined the same room as Alice and Bob.
- Each performed a turn and cast the other creator's private vote.
- Both saw identical final scores: Alice 1,225,000, Bob 900,000.
- Reloading Bob's tab restored his identity and final results.

Public deployment and post-deployment testing still require GitHub/Render account authorization.
