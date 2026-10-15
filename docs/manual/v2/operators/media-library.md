# Pictures: the Media library

The **Media** area (the fourth item on the left rail, in teal) holds every picture you might put on the screen:
announcement slides, photos, backgrounds, a church logo, pages of a PDF.

![The Media library: folders, tags and favorites on the left, pictures in the middle.](../images/media-library.png)

## Adding pictures

| How | What happens |
|---|---|
| **Add pictures** | Choose one or more picture files. |
| **Add folder** | Everything inside the folder (and its sub-folders) is added. Things that aren't pictures are skipped. |
| **Drag and drop** | Drop files or a folder anywhere on the Media area. |
| **Paste** | Copy a picture (or take a screenshot) and press **Ctrl+V** / **⌘V** on the Media area. |
| **Import PDF** | Turns every page of a PDF into a picture and queues them as one slideshow — see [Importing a PDF](media-on-screen.md#importing-a-pdf). |

**BORN keeps its own copy** of each picture, so a missing USB stick, a renamed folder or a moved file never
breaks a service. Your original is left alone.

> **Very large files:** tick **Don't copy (link in place)** before adding. BORN then uses the original where it is. The
> original must stay there (and its drive plugged in); if it moves, the picture shows as *missing* and BORN will
> never delete or change that original.

### What works

JPEG, PNG, GIF, WebP, BMP and AVIF. On a Mac, iPhone **HEIC** photos and TIFF are converted for you when you add them.
On Windows, HEIC is not supported: on the iPhone choose **Settings → Camera → Formats → Most Compatible**, or export the
photo as JPEG.

BORN tells you plainly when it can't use something — *damaged*, *cut off (incomplete)*, *empty*, *a PDF* (use Import PDF),
*a video* (arrives in a later version) — and never adds a broken picture to the library.

Adding the same picture twice does nothing: BORN recognises it by its contents (not its name) and says it was already there.

## Finding and organizing

- **Search** matches names, original file names and tags.
- **Folders** are yours to name. Drag a picture onto a folder to move it. Deleting a folder **never** deletes pictures.
- **Tags** — type a tag in the picture's detail pane. Click a tag on the left to see only those pictures.
- **Favorites** (star, or **F**) and **Recently used** keep what you use most one click away.
- **Needs attention** collects pictures whose file is missing, changed or unreadable.
- **Grid or list** with the buttons at the top right (the same choice as Sermons, Bible and Songs). **`\`** hides the list so the picture can be seen larger.

![A picture opened on the right, with tags, background and logo options.](../images/media-detail.png)

## Keyboard

| Key | Does |
|---|---|
| **← → ↑ ↓** | Move between pictures |
| **Q** or double-click | Add to the queue |
| **F** | Favorite / unfavorite |
| **Delete** | Remove from the library (with **Undo**) |
| **Ctrl/⌘-click** | Tick several pictures; then **Each to queue** or **As one slideshow** (in the order you ticked them) |
| **Menu key / right-click** | Context menu |

## Removing

**Remove from library** takes pictures out immediately and shows **Undo** (also **Ctrl/⌘+Z**). The file is erased about an hour
later. If the picture was one you linked in place, your original is **never** touched.

## Where it is stored

Inside BORN's data folder, in a `media` folder (the pictures, small previews, and `media.db`, which remembers names and
tags). To back up the library, copy that whole folder while BORN is closed.
