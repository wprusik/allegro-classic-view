# allegro-classic-view

This repository contains two extension variants:

- `firefox/` - Firefox version
- `chrome/` - Chrome version

## Development - Firefox (temporary loading)

To load the development version of the extension in Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Tymczasowo wczytaj dodatek**.
3. Select the extension manifest file from the `firefox/` folder (`manifest.json`).

## Development - Chrome (unpacked extension)

To load the development version of the extension in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `chrome/` folder.

## Packaging - Firefox

1. Go to the project directory.
2. Run the script:

```bat
build-firefox.bat
```

3. Or package the contents of the `firefox` folder manually into zip (without an extra parent directory):

4. Rename the file extension to `.xpi` (optional for local usage).  
In AMO, you can also upload ZIP and Mozilla will sign the add-on.

## Packaging - Chrome

1. Go to the project directory.
2. Run the script:

```bat
build-chrome.bat
```

3. Or package the contents of the `chrome` folder manually into zip (without an extra parent directory)
