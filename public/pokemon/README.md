# Pokemon Images Directory

This directory contains local Pokemon images that replace missing or broken URLs from PokeAPI.

## Structure

Images are organized by type:

### Official Artwork
- `{pokemon_id}.png` - Official artwork (regular)
- `shiny/{pokemon_id}.png` - Official artwork (shiny)

### Sprites
- `sprites/{pokemon_id}.png` - Front sprite (regular)
- `sprites/shiny/{pokemon_id}.png` - Front sprite (shiny)
- `sprites/back/{pokemon_id}.png` - Back sprite (regular)
- `sprites/back/shiny/{pokemon_id}.png` - Back sprite (shiny)
- `sprites/female/{pokemon_id}.png` - Front female sprite (regular)
- `sprites/shiny/female/{pokemon_id}.png` - Front female sprite (shiny)
- `sprites/back/female/{pokemon_id}.png` - Back female sprite (regular)
- `sprites/back/shiny/female/{pokemon_id}.png` - Back female sprite (shiny)

Example for Pokemon #25:
- Official: `25.png` and `shiny/25.png`
- Front sprite: `sprites/25.png` and `sprites/shiny/25.png`

## Adding Images

### Option 1: Using the Script

Run the download script to automatically download and update JSON files:

```bash
python scripts/download_pokemon_image.py <pokemon_id>
```

Example:
```bash
python scripts/download_pokemon_image.py 10282
```

The script will automatically:
- Download all available sprites (official, front, back, shiny, female variants, etc.)
- Download shiny versions where applicable
- Update the JSON file to use local paths for all downloaded sprites

### Option 2: Manual Placement

1. Download or create the image files
2. Save them in the appropriate directories (see Structure above)
3. Update the corresponding JSON file in `src/data/pokemon/{pokemon_id}.json`:
   - Change sprite URLs to local paths:
     - `artwork.official`: `/pokemon/{pokemon_id}.png`
     - `artwork.front`: `/pokemon/sprites/{pokemon_id}.png`
     - `artwork.shiny`: `/pokemon/sprites/shiny/{pokemon_id}.png`
     - `artwork.back`: `/pokemon/sprites/back/{pokemon_id}.png`
     - `artwork.back_shiny`: `/pokemon/sprites/back/shiny/{pokemon_id}.png`
     - And so on for other sprite types

## Path Format

In JSON files, use paths starting with `/pokemon/` (not `public/pokemon/`):
- ✅ Correct: `/pokemon/10282.png`
- ❌ Wrong: `public/pokemon/10282.png` or `./pokemon/10282.png`

Next.js automatically serves files from the `public/` directory at the root path.
