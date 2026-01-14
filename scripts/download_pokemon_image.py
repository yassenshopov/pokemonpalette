#!/usr/bin/env python3
"""
Script to download Pokemon images and update JSON files with local paths.
Usage: python scripts/download_pokemon_image.py <pokemon_id> [pokemon_id2 ...]
"""

import os
import sys
import json
import requests
from pathlib import Path

def download_image(url: str, local_path: str) -> bool:
    """Download an image from URL to local path."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        # Save the image
        with open(local_path, 'wb') as f:
            f.write(response.content)
        
        print(f"[OK] Downloaded: {local_path}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to download {url}: {e}")
        return False

def get_shiny_url(regular_url: str) -> str:
    """Convert a regular official artwork URL to its shiny version."""
    if "/other/official-artwork/" in regular_url:
        return regular_url.replace("/other/official-artwork/", "/other/official-artwork/shiny/")
    return regular_url

def get_local_path_for_sprite(pokemon_id: int, sprite_type: str) -> tuple[str, str]:
    """
    Get local path for a sprite type.
    Returns: (web_path, file_path)
    """
    sprite_paths = {
        "official": (f"/pokemon/{pokemon_id}.png", f"public/pokemon/{pokemon_id}.png"),
        "front": (f"/pokemon/sprites/{pokemon_id}.png", f"public/pokemon/sprites/{pokemon_id}.png"),
        "back": (f"/pokemon/sprites/back/{pokemon_id}.png", f"public/pokemon/sprites/back/{pokemon_id}.png"),
        "shiny": (f"/pokemon/sprites/shiny/{pokemon_id}.png", f"public/pokemon/sprites/shiny/{pokemon_id}.png"),
        "back_shiny": (f"/pokemon/sprites/back/shiny/{pokemon_id}.png", f"public/pokemon/sprites/back/shiny/{pokemon_id}.png"),
        "front_female": (f"/pokemon/sprites/female/{pokemon_id}.png", f"public/pokemon/sprites/female/{pokemon_id}.png"),
        "back_female": (f"/pokemon/sprites/back/female/{pokemon_id}.png", f"public/pokemon/sprites/back/female/{pokemon_id}.png"),
        "front_shiny_female": (f"/pokemon/sprites/shiny/female/{pokemon_id}.png", f"public/pokemon/sprites/shiny/female/{pokemon_id}.png"),
        "back_shiny_female": (f"/pokemon/sprites/back/shiny/female/{pokemon_id}.png", f"public/pokemon/sprites/back/shiny/female/{pokemon_id}.png"),
    }
    return sprite_paths.get(sprite_type, (f"/pokemon/{sprite_type}/{pokemon_id}.png", f"public/pokemon/{sprite_type}/{pokemon_id}.png"))

def update_sprite_field(pokemon_id: int, sprite_type: str, current_url: str, data: dict) -> bool:
    """Download and update a single sprite field."""
    if not current_url:
        return False
    
    # Get local paths
    web_path, file_path = get_local_path_for_sprite(pokemon_id, sprite_type)
    
    # Skip if already a local path
    if current_url.startswith('/'):
        if current_url == web_path:
            print(f"[INFO] {sprite_type} already using correct local path: {current_url}")
            return False  # No update needed
        else:
            # Different local path - update to standard if file exists at expected location
            if os.path.exists(file_path):
                print(f"[INFO] {sprite_type} updating to standard path: {web_path}")
                data['artwork'][sprite_type] = web_path
                return True
            print(f"[INFO] {sprite_type} using non-standard local path: {current_url}")
            return False
    
    # Skip if file already exists
    if os.path.exists(file_path):
        print(f"[INFO] {sprite_type} already exists locally: {file_path}")
        data['artwork'][sprite_type] = web_path
        return True
    
    # Try to download
    download_success = download_image(current_url, file_path)
    
    if download_success or os.path.exists(file_path):
        data['artwork'][sprite_type] = web_path
        print(f"[OK] Updated {sprite_type} to local path: {web_path}")
        return True
    else:
        print(f"[WARNING] Failed to download {sprite_type} from {current_url}")
        return False

def update_json_with_local_path(pokemon_id: int, image_type: str = "official") -> bool:
    """Update Pokemon JSON file to use local image paths for all sprites."""
    json_path = f"src/data/pokemon/{pokemon_id}.json"
    
    if not os.path.exists(json_path):
        print(f"[ERROR] JSON file not found: {json_path}")
        return False
    
    # Read the JSON file
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Get the current URL
    if not isinstance(data.get('artwork'), dict):
        print(f"[ERROR] Invalid artwork structure in {json_path}")
        return False
    
    updated = False
    
    # Define all sprite types to process
    sprite_types = [
        "official",
        "front",
        "back",
        "shiny",
        "back_shiny",
        "front_female",
        "back_female",
        "front_shiny_female",
        "back_shiny_female"
    ]
    
    # Process each sprite type
    for sprite_type in sprite_types:
        current_url = data['artwork'].get(sprite_type)
        if update_sprite_field(pokemon_id, sprite_type, current_url, data):
            updated = True
    
    # Special handling for official artwork shiny version
    official_url = data['artwork'].get('official')
    if official_url:
        if not official_url.startswith('/'):
            # Try to download shiny version from URL
            download_shiny_version(pokemon_id, official_url)
        else:
            # If already local, check for shiny version
            shiny_file_path = f"public/pokemon/shiny/{pokemon_id}.png"
            if not os.path.exists(shiny_file_path):
                shiny_url = f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/{pokemon_id}.png"
                download_image(shiny_url, shiny_file_path)
    
    # Write back to JSON if any updates were made
    if updated:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"[OK] Updated {json_path} with local paths")
        return True
    
    return False

def download_shiny_version(pokemon_id: int, regular_url: str) -> bool:
    """Download the shiny version of official artwork."""
    shiny_url = get_shiny_url(regular_url)
    shiny_local_path = f"/pokemon/shiny/{pokemon_id}.png"
    shiny_local_file_path = f"public{shiny_local_path}"
    
    # Skip if shiny image already exists locally
    if os.path.exists(shiny_local_file_path):
        print(f"[INFO] Shiny version already exists: {shiny_local_file_path}")
        return True
    
    print(f"[INFO] Attempting to download shiny version...")
    return download_image(shiny_url, shiny_local_file_path)

def parse_pokemon_ids(args: list[str]) -> list[int]:
    """Parse Pokemon IDs from command line arguments, supporting ranges."""
    pokemon_ids = []
    
    for arg in args:
        if '-' in arg:
            # Handle range format: "1-1024" or "1-1024:5" (with step)
            parts = arg.split(':')
            range_part = parts[0]
            step = int(parts[1]) if len(parts) > 1 else 1
            
            if '-' in range_part:
                start, end = range_part.split('-', 1)
                try:
                    start_id = int(start.strip())
                    end_id = int(end.strip())
                    if start_id > end_id:
                        start_id, end_id = end_id, start_id
                    pokemon_ids.extend(range(start_id, end_id + 1, step))
                except ValueError:
                    print(f"[ERROR] Invalid range format: {arg}")
                    sys.exit(1)
            else:
                print(f"[ERROR] Invalid range format: {arg}")
                sys.exit(1)
        else:
            # Single ID
            try:
                pokemon_ids.append(int(arg))
            except ValueError:
                print(f"[ERROR] Invalid Pokemon ID: {arg}")
                sys.exit(1)
    
    # Remove duplicates and sort
    return sorted(list(set(pokemon_ids)))

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/download_pokemon_image.py <pokemon_id> [pokemon_id2 ...]")
        print("       python scripts/download_pokemon_image.py <start>-<end>")
        print("       python scripts/download_pokemon_image.py <start>-<end>:<step>")
        print("\nExamples:")
        print("  python scripts/download_pokemon_image.py 10282")
        print("  python scripts/download_pokemon_image.py 1 2 3")
        print("  python scripts/download_pokemon_image.py 1-1024")
        print("  python scripts/download_pokemon_image.py 1-100:5  # Every 5th Pokemon")
        print("  python scripts/download_pokemon_image.py 1-100 200-300  # Multiple ranges")
        print("\nThis script will:")
        print("  - Download all available sprites (official, front, back, shiny, etc.)")
        print("  - Download shiny versions where applicable")
        print("  - Update the JSON file to use local paths")
        sys.exit(1)
    
    pokemon_ids = parse_pokemon_ids(sys.argv[1:])
    
    if not pokemon_ids:
        print("[ERROR] No valid Pokemon IDs provided")
        sys.exit(1)
    
    print(f"\n{'='*60}")
    print(f"Processing {len(pokemon_ids)} Pokemon(s)")
    print(f"{'='*60}")
    
    successful = 0
    failed = 0
    
    for idx, pokemon_id in enumerate(pokemon_ids, 1):
        print(f"\n[{idx}/{len(pokemon_ids)}] Processing Pokemon #{pokemon_id}...")
        print(f"{'-'*60}")
        try:
            if update_json_with_local_path(pokemon_id, "official"):
                successful += 1
            else:
                failed += 1
        except Exception as e:
            print(f"[ERROR] Failed to process Pokemon #{pokemon_id}: {e}")
            failed += 1
    
    print(f"\n{'='*60}")
    print(f"Summary: {successful} successful, {failed} failed")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
