# Tabs Anonymous

**One tab at a time.** Chrome extension with a shared tab budget, signed sponsor approvals, and temporary tabs. Version 0.2 uses manual email/chat exchange with no sponsor server, service URL, account password, device token, or network permissions.

## Install or update

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `extension` folder containing `manifest.json`. For an existing installation at this path, click **Reload**; reopen its settings page afterward. Pin Tabs Anonymous from Chrome’s puzzle-piece menu.

Both participant and sponsor install the extension. It works in solo mode immediately. Use **Settings & sponsor** to start pairing.

## Pair with a sponsor

1. Sponsor: enter your name and email in **Your identity**, then click **Create my sponsor card**. Copy the code and share it with your participant using a trusted email or conversation.
2. Participant: enter your own name and email. Paste the sponsor card in **Choose your sponsor**, click **Inspect card**, compare the fingerprint directly with your sponsor, and check the confirmation box.
3. Participant: click **Create pairing request** and send the resulting code to your sponsor.
4. Sponsor: paste that request in **Be a sponsor**, inspect it, verify the participant’s fingerprint through your trusted conversation, and confirm. Set their initial total budget and click **Sign approval** (or decline).
5. Participant: paste the returned code in **Sponsor’s decision code** and click **Import decision**. Your approved budget now locks; only valid decisions signed by this sponsor can change it through the extension UI.

A signed card binds a name and email to a key, but does **not** verify inbox ownership. Confirm fingerprints outside the extension to avoid accepting a substituted identity.

## Request more tabs

From the over-limit page or settings, enter the desired total budget and reason and create a signed request. Copy the entire code into an email or chat. The sponsor imports and inspects it in **Be a sponsor**, sets the total budget, and signs an approval or decline. Paste the resulting decision back into the extension. The over-limit page can import an approval and continue immediately if the new budget leaves space.

Only one participant request can be pending at once; requesting again returns the same code. Requests remain available in settings after a restart. Reimporting a request on the sponsor side returns its original signed decision. Importing an already-used or older decision on the participant side fails. A decline clears the pending request so you can try again; declined initial pairing allows a fresh pairing.

**No email is sent automatically.** The optional **Compose email** link opens your mail app with a code; you send it yourself. If your mail app truncates a long code, paste it manually. There is no background polling, push notification, relay, or hosted dashboard. This is serverless signed exchange, not a live peer-to-peer network connection.

## Tabs and lifetimes

The budget covers normal, non-incognito windows in this profile. Existing tabs are grandfathered; new tabs beyond the budget show the waiting page. Choose a specific tab to close or use random, oldest (FIFO), or newest (LIFO). Quick choices skip pinned tabs. Closing tabs can discard unsaved work.

In the popup, set a lifetime on the current tab or open a temporary tab. Default shortcut: **Command+Shift+Y** on macOS, **Ctrl+Shift+Y** elsewhere; customize it at `chrome://extensions/shortcuts`. Timers continue through sleep while the browser session exists, but reset when Chrome restarts. Chrome may delay background execution. Extension settings pages do not count toward your budget. Waiting-page destinations also live in session storage: after a full Chrome restart or extension reload, a restored waiting page may no longer know its original destination. Reopen the original URL manually.

## Identity, privacy, and recovery

On first background startup, Web Crypto generates a P-256 signing keypair. The private key is nonextractable and stored as a CryptoKey in extension-origin IndexedDB; it is never included in an exchange code or settings response. Public identity, signed messages, and relationship state are saved locally. No browsing URLs or titles are included in sponsor codes; the reason you type is shared.

There is no identity backup, export, revocation, or recovery flow yet. Uninstalling or clearing extension storage loses your identity and relationships, requiring fresh pairing. Ordinary extension reloads and browser restarts preserve identity. Treat copies of your browser profile as sensitive. Nonextractability is not protection against someone controlling the browser or extension code. This is a voluntary accountability tool: its owner can disable, uninstall, modify it, or edit local state.

## Upgrading the service-based prototype

The first reload preserves old service settings and credentials in local `legacySponsorSettings`, retains the tab budget and temporary-tab default, and switches to solo mode. Establish a new signed pairing. Old service tokens are not signing identities and cannot be reused. Legacy server sources and their tests were moved outside this deliverable to `work/legacy-tabkind` during the update; no server is needed for this version.

## Validation

Run `npm test` with a recent Node.js. Tests cover tab gating/selection/timers and cryptographic integrity, wrong identities, wrong pairing/request, replay, monotonic decisions, and invalid schemas. Manual Chrome verification is still necessary for IndexedDB persistence, extension loading, clipboard/mail clients, and the two-profile exchange flow.
