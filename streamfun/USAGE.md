# StreamFun Locker: how to use

The locker is one JS file: `streamfun-locker.js`. You add it to a page that has a video
player. It puts a message on top of the player and asks the viewer to use StreamFun VPN.
If the viewer already has the VPN on, the message goes away and the video plays.

## How it works

1. The page loads. The locker shows a play button over the player.
2. The viewer presses play. The video plays for 6 seconds.
3. After 6 seconds the video pauses and the locker message appears on top of the player.
4. The message has a button. The button opens the VPN page (`vpnUrl`).
5. Every 5 seconds the script asks our API if the viewer is connected to the VPN.
   It also asks again when the viewer comes back to the tab.
6. When the API says the VPN is on, the locker shows "Continue watching".
   The viewer clicks it and the video plays again.

The script remembers that the player was locked, so after a page reload the viewer
sees the locker right away and does not get the 6-second preview again.

If `canClose` is on, the message has an X in the corner. The X closes the message and the
video keeps playing.

## Step 1. Upload the file

Put `streamfun-locker.js` on your server, for example in `/js/streamfun-locker.js`.

## Step 2. Wrap your player

The locker needs a container around the video. It draws the message inside this
container, so the container should be the same size as the player.

```html
<div class="player">
  <video id="clip" src="/video/stream.mp4" playsinline muted></video>
</div>
```

You can use your own class or id. You only need to tell the script which one it is
(see `mount` and `player` below).

If the container has `position: static`, the script changes it to `position: relative`.
You do not need to add any CSS. The script adds its own styles.

## Step 3. Add the settings and the script

Add these two tags before `</body>`. The settings tag goes first, the script goes second.

```html
<script>
  window.StreamSharkLocker = {
    mount: '.player',      // the container around the player
    player: '#clip',       // the <video> element
    apiUrl: 'https://api.streamfun.io/api/v1/connection/status',
    vpnUrl: 'https://streamfun.io/paywall16',
    canClose: true,
    platforms: ['ios', 'android']
  };
</script>
<script src="/js/streamfun-locker.js"></script>
```

If your site uses templates (PHP, Twig, Blade, WordPress and so on), put the same two
tags in the template of the page with the player, at the bottom before `</body>`.
If the player is only on some pages, add the tags only to those pages.

## Settings

| Setting         | What it does                                                        | Default               |
|-----------------|---------------------------------------------------------------------|-----------------------|
| `mount`         | CSS selector of the container around the player                     | `.player`             |
| `player`        | CSS selector of the `<video>`. If not set, the first `<video>` inside `mount` is used | first video in `mount` |
| `apiUrl`        | URL that tells if the viewer has the VPN on                         | `api.streamshark.tech` |
| `vpnUrl`        | Where the button on the message goes                                | empty                 |
| `lockDelay`     | How long the video plays before the lock, in ms                     | `6000`                |
| `poll`          | How often to check the VPN, in ms. `0` turns it off                 | `5000`                |
| `canClose`      | Show the X that closes the message                                  | `false`               |
| `platforms`     | Who sees the locker: `'ios'`, `'android'`, `'desktop'`              | all three             |
| `openInNewTab`  | Open `vpnUrl` in a new tab                                          | `true`                |
| `autoRedirect`  | Go to `vpnUrl` right away, without waiting for a click              | `false`               |
| `redirectDelay` | Wait time before `autoRedirect`, in ms                              | `0`                   |
| `storageKey`    | Prefix for the keys the script saves in localStorage                | `ss`                  |
| `text`          | Your own texts for the message (see below)                          | English texts         |

### Who sees the locker

```js
platforms: ['ios']             // iPhone and iPad only
platforms: ['android']         // Android only
platforms: ['ios', 'android']  // phones only, no desktop
```

The platform is taken from the browser User-Agent. iPads are counted as `ios`.
If the viewer is not in the list, the script does nothing and the player works as usual.

### Texts

You can change any of the texts. The ones you leave out stay as default.

```js
text: {
  lockedTitle: 'Privacy & Security Notice',
  lockedText:  'Streaming this content may be restricted or unprotected in your country. For your online safety and data privacy, we highly recommend using a secure connection.',
  ctaText:     '🔓 Secure My Connection with StreamFun VPN',
  resumeTitle: 'Continue watching',
  resumeText:  'VPN connected — stream unlocked'
}
```

## API answer

`apiUrl` is called with a GET request. It should return JSON:

```json
{ "connected": true }
```

`true` means the VPN is on and the video can play. `false` means the locker stays.
If the request fails, the script keeps the current state and tries again later.

## Control from your own code

After the script loads, you can use:

```js
StreamSharkLockerAPI.check();   // check the VPN now
StreamSharkLockerAPI.lock();    // show the locker now
StreamSharkLockerAPI.unlock();  // hide the locker and play the video
```

## Example

`paywall17.html` is a full working page with a player and the locker. Open it to see
how everything fits together.
