# Drop-In Verdict

**Know if a shade will suit you before you buy it.**

Drop-In Verdict is a widget any beauty brand can add to a product page with one script tag. The shopper takes a selfie, the widget measures their skin tone, shows a foundation preview, and gives a clear verdict (good match, close match, poor match, or can't tell) with the reasons. If the photo isn't good enough to trust, it says so before spending anything and explains how to retake it.

Built with the [YouCam API](https://yce.makeupar.com/ai-api) for the YouCam API Skin AI & eCommerce VTO Hackathon.

> In development. Cosmetic guidance only, not medical advice.

## How it works

1. The shopper consents, then takes a selfie or uploads a photo.
2. A free on-device check rejects unusable photos with a specific fix.
3. The server calls the YouCam API for skin tone and a foundation preview.
4. A deterministic engine compares skin tone to the shade (CIEDE2000) and explains the result.
5. Per-session and global caps keep API usage under budget.

## Quick start

Requires Node 20.9 or newer.

```bash
git clone git@github.com:noirithm/dropin-verdict.git
cd dropin-verdict
cp .env.example .env    # add your YouCam API key
npm install
npm run dev
```

| Variable | Description |
| --- | --- |
| `YOUCAM_API_KEY` | YouCam API key. Server-side only, never committed. |
| `YOUCAM_API_BASE` | API base URL. Default: `https://yce-api-01.makeupar.com` |

## Privacy

Photos are processed in memory and not stored by this app. They are sent to the YouCam API, which retains uploads for up to 30 days per its documentation. See `docs/PRIVACY_AND_LIMITATIONS.md` once available.

## Docs

- [API notes](docs/API_NOTES.md): what the YouCam API actually returns, with costs

## Live demo

Coming soon.
