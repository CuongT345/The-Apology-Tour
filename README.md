# The Apology Tour

A multiplayer party game for 2–8 players. Public site: https://the-apology-tour.onrender.com/

## Play live

Create a room and share its six-character code. Each player opens their own screen. The host selects rounds and apology length, then starts the tour.

On your turn, draw your scandal, click **Enable camera & microphone**, and then **Go live to the room**. The private preview does not transmit camera or microphone tracks. Connections are prepared during preview; tracks are attached only after Go live. Viewers click **Enable live sound** to hear the apology. Simulated bot comments appear on the right of the video on desktop; phones stack them vertically. Audience members can doodle privately, save their drawing, and send emoji reactions.

Ending the live apology or reaching the timer immediately opens private voting. There is no recording, upload, preview review, or replay step in the default live flow. Creators cannot vote for themselves. Everyone starts with 1M subscribers. Each judge's Forgiven vote adds 150K, Mid adds 25K, and Worse loses 100K. A strict majority accepting the twist adds 75K. Highest final score wins.

Default scandals are fictional adult cheating disasters, fake relationships, influencer scandals, furry-convention chaos, and absurd nonsexual animal scandals. The original mild deck is retained in source for potential future modes. The 48 scandals and 48 twists are shuffled into per-session decks and consumed without replacement, including redraws. They reset only after the finished session is restarted. If the decks are exhausted, further redraws are blocked without charging subscribers and the host can end that session.

## Network behavior

Live video uses one-way WebRTC from the active creator to each viewer. Authenticated, addressed signaling travels through the game server. Video and audio travel directly between browsers. Public Google STUN servers help discover direct connections. No TURN relay is provisioned, so restrictive NATs, corporate firewalls, or some mobile networks may prevent video from connecting. The UI exposes reconnect controls and connection status. Broad cross-network reliability would require a TURN relay or managed real-time media provider.

Live sessions are not recorded or uploaded. Browsers request camera and microphone permission only through the player's action. Media tracks stop on leaving, ending the apology, or closing the page. The previous room-private recorded-video implementation remains in code for compatibility, including authenticated clip access, a 16 MB per-clip limit, watch-before-vote, and clearing on turn changes.

## Run and test

Requires Node 22 or newer; no third-party dependencies.

```sh
node server.js
node --test
```

The server binds to `0.0.0.0` using Render's `PORT` (3000 locally). `/health` returns readiness. Five integration tests cover session deck uniqueness/reset/exhaustion, live signaling authorization and immediate voting, recorded clip privacy, full-game scores, and private pending votes. Local browser QA uses synthetic camera/audio in a separate, undeployed harness. The speaker path uses a user-enabled Web Audio graph independent of the muted video preview and survives game screen updates. An indicator reports received audio packets and decoded sound level. Browser QA verified nonzero decoded audio samples, reactions, mute/unmute, and reconnect.

## Render

- Plan: Free, one instance
- Build: `node --check server.js && node --test`
- Start: `node server.js`
- Health check: `/health`
- Root directory: blank

Rooms and transient signaling reside in one process's memory and reset on restart or redeploy. Free instances sleep after 15 minutes without inbound traffic and may take about a minute to wake. Active room polling supplies traffic during play. This public-repository deployment uses manual deployment for source changes.
