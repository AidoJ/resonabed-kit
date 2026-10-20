<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Promo discounts

- Store fixed promo amounts in integer cents; a non-null fixed amount overrides the legacy percentage field so existing percentage codes remain compatible. Orders freeze the monetary discount, and percentage is null for fixed codes to avoid misreporting.

## Session audio

- Session music and the session-end sequence are scheduled on the device audio clock (Web Audio) rather than page timers, so the ending still fires when the screen locks or the tab is backgrounded; page timers only mirror the display.
- The closing recording is started only by the booked ending and never during start-up unlock, because a muted pre-play of it has leaked audible sound at the beginning of sessions on some devices.
- Any change to session playback must keep working for every access mode (clinic, home user, support and admin) and must not rely on a single clinic's licence or signed URL being the only source of the track.

