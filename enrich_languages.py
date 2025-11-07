import os
import json
import requests
import time
from typing import Dict, Any, List, Optional

# Rate limiting: PokeAPI recommends not making more than 100 requests per minute
# We'll add a small delay between requests to be respectful
REQUEST_DELAY = 0.6  # seconds between requests

def fetch_species_data(pokemon_id: int) -> Dict[str, Any]:
    """Fetch species data from PokeAPI for a given Pokemon ID."""
    url = f"https://pokeapi.co/api/v2/pokemon-species/{pokemon_id}"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 404:
            print(f"  ⚠ Pokemon #{pokemon_id} not found in PokeAPI")
            return {}
        else:
            print(f"  ⚠ Failed to fetch Pokemon #{pokemon_id}: HTTP {response.status_code}")
            return {}
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Error fetching Pokemon #{pokemon_id}: {e}")
        return {}

def extract_language_names(species_data: Dict[str, Any]) -> Dict[str, str]:
    """Extract Pokemon names in different languages from species data."""
    names = {}
    
    if not species_data or 'names' not in species_data:
        return names
    
    for name_entry in species_data['names']:
        language_code = name_entry.get('language', {}).get('name', '')
        pokemon_name = name_entry.get('name', '')
        
        if language_code and pokemon_name:
            names[language_code] = pokemon_name
    
    return names

def enrich_pokemon_file(file_path: str, pokemon_id: int) -> Optional[bool]:
    """Enrich a single Pokemon JSON file with language data.
    
    Returns:
        True if successfully enriched
        False if failed
        None if already enriched (skipped)
    """
    try:
        # Read existing Pokemon data
        with open(file_path, 'r', encoding='utf-8') as f:
            pokemon_data = json.load(f)
        
        # Display Pokemon name
        pokemon_name = pokemon_data.get('name', 'Unknown')
        print(f"  Pokemon: {pokemon_name}")
        
        # Check if names already exist (skip if already enriched)
        if 'names' in pokemon_data and pokemon_data['names']:
            print(f"  ⊙ Already has language data, skipping...")
            return None
        
        # Fetch species data from PokeAPI
        print(f"  Fetching language data for Pokemon #{pokemon_id}...")
        species_data = fetch_species_data(pokemon_id)
        
        if not species_data:
            return False
        
        # Extract language names
        language_names = extract_language_names(species_data)
        
        if not language_names:
            print(f"  ⚠ No language data found for Pokemon #{pokemon_id}")
            return False
        
        # Add names to Pokemon data
        pokemon_data['names'] = language_names
        
        # Save updated data back to file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(pokemon_data, f, indent=2, ensure_ascii=False)
        
        # Show summary of languages added
        languages = list(language_names.keys())
        print(f"  ✓ Added {len(languages)} languages: {', '.join(sorted(languages))}")
        
        return True
        
    except json.JSONDecodeError as e:
        print(f"  ✗ Error reading JSON file {file_path}: {e}")
        return False
    except Exception as e:
        print(f"  ✗ Error processing {file_path}: {e}")
        return False

def main():
    """Main function to enrich all Pokemon files with language data."""
    data_dir = "src/data/pokemon"
    
    if not os.path.exists(data_dir):
        print(f"✗ Error: Data directory '{data_dir}' not found!")
        return
    
    # Get all JSON files in the directory (excluding index.json)
    json_files = [
        f for f in os.listdir(data_dir)
        if f.endswith('.json') and f != 'index.json' and f.replace('.json', '').isdigit()
    ]
    
    if not json_files:
        print(f"✗ No Pokemon JSON files found in '{data_dir}'")
        return
    
    # Sort files by Pokemon ID
    json_files.sort(key=lambda x: int(x.replace('.json', '')))
    
    total_files = len(json_files)
    successful = 0
    failed = 0
    skipped = 0
    
    print(f"Found {total_files} Pokemon files to process\n")
    print("=" * 60)
    
    for idx, filename in enumerate(json_files, 1):
        pokemon_id = int(filename.replace('.json', ''))
        file_path = os.path.join(data_dir, filename)
        
        print(f"\n[{idx}/{total_files}] Processing {filename} (Pokemon #{pokemon_id})")
        
        # Enrich the file (function handles checking if already enriched)
        result = enrich_pokemon_file(file_path, pokemon_id)
        
        if result is None:
            skipped += 1
        elif result:
            successful += 1
        else:
            failed += 1
        
        # Rate limiting: wait between requests
        if idx < total_files:
            time.sleep(REQUEST_DELAY)
    
    print("\n" + "=" * 60)
    print("\n✓ Enrichment complete!")
    print(f"  • Total files: {total_files}")
    print(f"  • Successfully enriched: {successful}")
    print(f"  • Already had language data: {skipped}")
    print(f"  • Failed: {failed}")

if __name__ == "__main__":
    main()

