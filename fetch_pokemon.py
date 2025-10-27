import requests
import json
import os
from typing import Dict, Any, List, Optional

def fetch_pokemon_data(pokemon_id: int) -> Dict[str, Any]:
    """Fetch Pokémon data from PokeAPI."""
    url = f"https://pokeapi.co/api/v2/pokemon/{pokemon_id}"
    print(f"Fetching data for Pokémon #{pokemon_id}...")
    
    response = requests.get(url)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch Pokémon #{pokemon_id}")
    
    pokemon_data = response.json()
    return pokemon_data

def fetch_species_data(pokemon_id: int) -> Dict[str, Any]:
    """Fetch species data from PokeAPI."""
    url = f"https://pokeapi.co/api/v2/pokemon-species/{pokemon_id}"
    response = requests.get(url)
    if response.status_code != 200:
        return {}
    return response.json()

def fetch_evolution_chain(url: str) -> Optional[Dict[str, Any]]:
    """Fetch evolution chain data."""
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return None

def fetch_move_details(url: str) -> Optional[Dict[str, Any]]:
    """Fetch detailed move data."""
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return None

def fetch_form_details(url: str) -> Optional[Dict[str, Any]]:
    """Fetch detailed form data."""
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return None

def transform_pokemon_data(pokemon_id: int, pokemon_data: Dict, species_data: Dict, evolution_chain_data: Optional[Dict] = None) -> Dict[str, Any]:
    """Transform PokeAPI data to our project format with comprehensive data."""
    
    # Extract basic info
    name = pokemon_data['name'].capitalize()
    base_experience = pokemon_data.get('base_experience', 0)
    order = pokemon_data.get('order', pokemon_id)
    is_default = pokemon_data.get('is_default', True)
    
    # Get species name from species data
    species = species_data.get('genera', [])
    species_name = "Pokémon"
    for genus in species:
        if genus.get('language', {}).get('name') == 'en':
            species_name = genus.get('genus', 'Pokémon')
            break
    
    # Convert types with detailed info
    types = []
    type_details = []
    for type_info in pokemon_data['types']:
        type_name = type_info['type']['name'].capitalize()
        slot = type_info['slot']
        types.append(type_name)
        type_details.append({
            "name": type_name,
            "slot": slot
        })
    
    # Convert height (from decimeters to meters)
    height = pokemon_data['height'] / 10
    
    # Convert weight (from hectograms to kilograms)
    weight = pokemon_data['weight'] / 10
    
    # Get abilities with details
    abilities = []
    for ability_info in pokemon_data['abilities']:
        abilities.append({
            "name": ability_info['ability']['name'].capitalize().replace('-', ' '),
            "url": ability_info['ability']['url'],
            "is_hidden": ability_info['is_hidden'],
            "slot": ability_info['slot']
        })
    
    # Extract base stats
    stats_dict = {}
    for stat in pokemon_data['stats']:
        stat_name = stat['stat']['name']
        if stat_name == 'hp':
            stats_dict['hp'] = stat['base_stat']
        elif stat_name == 'attack':
            stats_dict['attack'] = stat['base_stat']
        elif stat_name == 'defense':
            stats_dict['defense'] = stat['base_stat']
        elif stat_name == 'special-attack':
            stats_dict['specialAttack'] = stat['base_stat']
        elif stat_name == 'special-defense':
            stats_dict['specialDefense'] = stat['base_stat']
        elif stat_name == 'speed':
            stats_dict['speed'] = stat['base_stat']
    
    # Get description from species
    flavor_text = ""
    flavor_texts = []
    for text in species_data.get('flavor_text_entries', []):
        if text.get('language', {}).get('name') == 'en':
            clean_text = text.get('flavor_text', '').replace('\n', ' ').replace('\f', ' ')
            if not flavor_text:
                flavor_text = clean_text
            flavor_texts.append({
                "text": clean_text,
                "version": text.get('version', {}).get('name', 'unknown')
            })
    
    # Get habitat
    habitat = species_data.get('habitat', {}).get('name', 'Unknown').capitalize() if species_data.get('habitat') else 'Unknown'
    
    # Get generation
    generation = species_data.get('generation', {}).get('name', '').split('-')[-1] if species_data.get('generation') else '1'
    generation_num = int(generation) if generation.isdigit() else 1
    
    # Species metadata
    capture_rate = species_data.get('capture_rate', 45)
    base_happiness = species_data.get('base_happiness', 70)
    growth_rate = species_data.get('growth_rate', {}).get('name', 'medium').replace('-', ' ')
    hatch_counter = species_data.get('hatch_counter', 20)
    has_gender_differences = species_data.get('has_gender_differences', False)
    gender_rate = species_data.get('gender_rate', -1)
    
    # Determine rarity
    is_legendary = species_data.get('is_legendary', False)
    is_mythical = species_data.get('is_mythical', False)
    is_baby = species_data.get('is_baby', False)
    rarity = "Legendary" if is_legendary else ("Mythical" if is_mythical else ("Baby" if is_baby else "Common"))
    
    # Comprehensive artwork URLs
    sprites = pokemon_data.get('sprites', {})
    artwork = {
        "official": f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{pokemon_id}.png",
        "front": sprites.get('front_default'),
        "back": sprites.get('back_default'),
        "shiny": sprites.get('front_shiny'),
        "back_shiny": sprites.get('back_shiny'),
        "front_female": sprites.get('front_female'),
        "back_female": sprites.get('back_female'),
        "front_shiny_female": sprites.get('front_shiny_female'),
        "back_shiny_female": sprites.get('back_shiny_female')
    }
    
    # Get detailed moves
    moves = []
    for move_info in pokemon_data.get('moves', []):
        move_name = move_info['move']['name']
        move_url = move_info['move']['url']
        
        # Get move details
        move_data = fetch_move_details(move_url)
        
        move_entry = {
            "name": move_name.replace('-', ' ').title(),
            "url": move_url
        }
        
        if move_data:
            move_entry.update({
                "type": move_data.get('type', {}).get('name', 'normal').capitalize() if move_data.get('type') else "Normal",
                "power": move_data.get('power'),
                "accuracy": move_data.get('accuracy'),
                "pp": move_data.get('pp'),
                "damage_class": move_data.get('damage_class', {}).get('name', 'unknown') if move_data.get('damage_class') else "unknown",
                "priority": move_data.get('priority', 0)
            })
        
        moves.append(move_entry)
    
    # Held items
    held_items = []
    for item_info in pokemon_data.get('held_items', []):
        held_items.append({
            "name": item_info['item']['name'].replace('-', ' ').title(),
            "rarity": item_info.get('version_details', [{}])[0].get('rarity', 1) if item_info.get('version_details') else 1
        })
    
    # Get forms with detailed information
    forms_list = []
    forms = pokemon_data.get('forms', [])
    for form_info in forms:
        form_url = form_info.get('url', '')
        form_name = form_info.get('name', '')
        
        # Fetch form details to get sprites and form-specific data
        form_data = fetch_form_details(form_url) if form_url else None
        
        form_entry = {
            "name": form_name.capitalize().replace('-', ' '),
            "raw_name": form_name
        }
        
        if form_data:
            form_sprites = form_data.get('sprites', {})
            form_entry.update({
                "form_name": form_data.get('form_name', ''),
                "is_mega": form_data.get('is_mega', False),
                "is_gigantamax": form_data.get('is_gigantamax', False),
                "is_battle_only": form_data.get('is_battle_only', False),
                "is_default": form_data.get('is_default', False),
                "sprites": {
                    "front_default": form_sprites.get('front_default'),
                    "back_default": form_sprites.get('back_default'),
                    "front_shiny": form_sprites.get('front_shiny'),
                    "back_shiny": form_sprites.get('back_shiny'),
                    "front_female": form_sprites.get('front_female'),
                    "back_female": form_sprites.get('back_female')
                }
            })
        
        forms_list.append(form_entry)
    
    # Get varieties (Mega evolutions, Gigantamax, etc.) with more details
    varieties = []
    varieties_data = species_data.get('varieties', [])
    for variety in varieties_data:
        variety_pokemon = variety.get('pokemon', {})
        variety_name = variety_pokemon.get('name', '')
        variety_url = variety_pokemon.get('url', '')
        
        # Extract variety details (like Alolan, Galarian, etc.)
        variety_type = ""
        if '-alola' in variety_name:
            variety_type = "Alolan"
        elif '-galar' in variety_name:
            variety_type = "Galarian"
        elif '-hisui' in variety_name:
            variety_type = "Hisuian"
        elif '-paldea' in variety_name:
            variety_type = "Paldean"
        elif '-mega' in variety_name:
            variety_type = "Mega"
        elif '-gmax' in variety_name:
            variety_type = "Gigantamax"
        
        varieties.append({
            "name": variety_name.capitalize().replace('-', ' '),
            "raw_name": variety_name,
            "is_default": variety.get('is_default', False),
            "url": variety_url,
            "type": variety_type
        })
    
    # Cries
    cries = pokemon_data.get('cries', {})
    
    # Evolution chain processing
    evolution_chain = []
    if evolution_chain_data:
        chain = evolution_chain_data.get('chain', {})
        def process_chain(chain_link, level=1):
            pokemon_name = chain_link.get('species', {}).get('name', '').capitalize()
            evolution_details = []
            
            if chain_link.get('evolution_details'):
                for detail in chain_link['evolution_details']:
                    evol_detail = {}
                    if detail.get('gender'):
                        evol_detail['gender'] = detail['gender']
                    if detail.get('held_item'):
                        evol_detail['held_item'] = detail['held_item']['name'].replace('-', ' ')
                    if detail.get('item'):
                        evol_detail['item'] = detail['item']['name'].replace('-', ' ')
                    if detail.get('min_level'):
                        evol_detail['min_level'] = detail['min_level']
                    if detail.get('trigger'):
                        evol_detail['trigger'] = detail['trigger']['name'].replace('-', ' ')
                    evolution_details.append(evol_detail)
            
            evolution_chain.append({
                "name": pokemon_name,
                "level": level,
                "details": evolution_details
            })
            
            for evolves_to in chain_link.get('evolves_to', []):
                process_chain(evolves_to, level + 1)
        
        process_chain(chain)
    
    # Create color palette based on types
    type_colors = {
        'Grass': {'primary': '#78C850', 'secondary': '#A040A0', 'accent': '#F8D030'},
        'Poison': {'primary': '#A040A0', 'secondary': '#78C850', 'accent': '#F8D030'},
        'Fire': {'primary': '#F08030', 'secondary': '#6890F0', 'accent': '#F8D030'},
        'Water': {'primary': '#6890F0', 'secondary': '#F08030', 'accent': '#F8D030'},
        'Electric': {'primary': '#F8D030', 'secondary': '#F08030', 'accent': '#F8F8F8'},
        'Normal': {'primary': '#A8A878', 'secondary': '#F8D030', 'accent': '#F8F8F8'},
        'Psychic': {'primary': '#F85888', 'secondary': '#6890F0', 'accent': '#F8F8F8'},
        'Rock': {'primary': '#B8A038', 'secondary': '#A040A0', 'accent': '#F8D030'},
        'Ground': {'primary': '#E0C068', 'secondary': '#B8A038', 'accent': '#F8D030'},
        'Bug': {'primary': '#A8B820', 'secondary': '#78C850', 'accent': '#F8D030'},
        'Flying': {'primary': '#A890F0', 'secondary': '#E0C068', 'accent': '#F8F8F8'},
    }
    
    primary_type = types[0] if types else 'Normal'
    type_color = type_colors.get(primary_type, {'primary': '#A8A878', 'secondary': '#F8D030', 'accent': '#F8F8F8'})
    
    color_palette = {
        "primary": type_color['primary'],
        "secondary": type_color['secondary'],
        "accent": type_color['accent'],
        "background": "#F8F8F8",
        "text": "#2C2C2C",
        "highlights": [type_color['primary'], type_color['secondary'], type_color['accent']]
    }
    
    result = {
        "id": pokemon_id,
        "name": name,
        "species": species_name,
        "type": types,
        "typeDetails": type_details,
        "height": height,
        "weight": weight,
        "abilities": abilities,
        "baseStats": stats_dict,
        "description": flavor_text,
        "flavorTexts": flavor_texts[:5],  # First 5 flavor texts
        "colorPalette": color_palette,
        "artwork": artwork,
        "evolution": evolution_chain if evolution_chain else {"stage": 1, "generation": generation_num},
        "moves": moves[:15],  # First 15 moves to keep it manageable
        "habitat": habitat,
        "generation": generation_num,
        "rarity": rarity,
        "baseExperience": base_experience,
        "order": order,
        "isDefault": is_default,
        "captureRate": capture_rate,
        "baseHappiness": base_happiness,
        "growthRate": growth_rate,
        "hatchCounter": hatch_counter,
        "hasGenderDifferences": has_gender_differences,
        "genderRate": gender_rate,
        "forms": forms_list,
        "varieties": varieties,
        "heldItems": held_items,
        "cries": cries
    }
    
    return result

def is_base_pokemon(pokemon_id: int, pokemon_name: str) -> bool:
    """Check if this is a base Pokemon (not a variety like Mega, G-Max, etc.)."""
    # Varieties typically have IDs >= 10000
    if pokemon_id >= 10000:
        return False
    
    # Check for variety indicators in name
    name_lower = pokemon_name.lower()
    variety_indicators = ['-mega', '-gmax', '-alola', '-galar', '-hisui', '-paldea']
    
    for indicator in variety_indicators:
        if indicator in name_lower:
            return False
    
    return True

def update_index(new_pokemon: Dict[str, Any], index_path: str):
    """Update the index.json file with new Pokémon."""
    # Only add base Pokemon to the index, not varieties
    if not is_base_pokemon(new_pokemon['id'], new_pokemon['name']):
        return
    
    if os.path.exists(index_path):
        with open(index_path, 'r') as f:
            index_data = json.load(f)
    else:
        index_data = []
    
    # Check if Pokémon already exists in index
    existing_ids = [pkmn['id'] for pkmn in index_data]
    
    if new_pokemon['id'] not in existing_ids:
        index_entry = {
            "id": new_pokemon['id'],
            "name": new_pokemon['name'],
            "species": new_pokemon['species'],
            "type": new_pokemon['type'],
            "generation": new_pokemon['generation'],
            "rarity": new_pokemon['rarity']
        }
        index_data.append(index_entry)
        
        # Sort by ID
        index_data.sort(key=lambda x: x['id'])
    
    with open(index_path, 'w') as f:
        json.dump(index_data, f, indent=2)

def main():
    """Main function to fetch and save Pokémon data."""
    base_dir = "src/data/pokemon"
    
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)
    
    index_path = os.path.join(base_dir, "index.json")
    
    # Fetch Pokémon 1-10
    for pokemon_id in range(387, 1026):
        try:
            # Fetch data from PokeAPI
            pokemon_data = fetch_pokemon_data(pokemon_id)
            species_data = fetch_species_data(pokemon_id)
            
            # Fetch evolution chain
            evolution_chain_url = species_data.get('evolution_chain', {}).get('url')
            evolution_chain_data = None
            if evolution_chain_url:
                evolution_chain_data = fetch_evolution_chain(evolution_chain_url)
            
            # Transform data to our format
            transformed_data = transform_pokemon_data(pokemon_id, pokemon_data, species_data, evolution_chain_data)
            
            # Debug: print forms info
            print(f"  Forms: {len(transformed_data.get('forms', []))} found")
            
            # Save individual file
            file_path = os.path.join(base_dir, f"{pokemon_id}.json")
            with open(file_path, 'w') as f:
                json.dump(transformed_data, f, indent=2)
            
            print(f"✓ Saved {transformed_data['name']} (#{pokemon_id})")
            
            # Update index
            update_index(transformed_data, index_path)
            
            # Fetch all varieties (Mega, G-Max, regional forms, etc.)
            varieties_data = species_data.get('varieties', [])
            for variety in varieties_data:
                variety_pokemon = variety.get('pokemon', {})
                variety_url = variety_pokemon.get('url', '')
                
                if variety_url:
                    try:
                        # Extract variety ID from URL
                        variety_id_match = variety_url.rstrip('/').split('/')[-1]
                        variety_id = int(variety_id_match) if variety_id_match.isdigit() else None
                        
                        if variety_id and variety_id != pokemon_id:  # Don't duplicate the base form
                            print(f"  Fetching variety...")
                            variety_pokemon_data = fetch_pokemon_data(variety_id)
                            variety_species_data = fetch_species_data(variety_id)
                            
                            # Fetch evolution chain for variety
                            variety_evolution_chain_url = variety_species_data.get('evolution_chain', {}).get('url')
                            variety_evolution_chain_data = None
                            if variety_evolution_chain_url:
                                variety_evolution_chain_data = fetch_evolution_chain(variety_evolution_chain_url)
                            
                            # Transform variety data
                            variety_transformed = transform_pokemon_data(variety_id, variety_pokemon_data, variety_species_data, variety_evolution_chain_data)
                            
                            # Save variety file
                            variety_file_path = os.path.join(base_dir, f"{variety_id}.json")
                            with open(variety_file_path, 'w') as f:
                                json.dump(variety_transformed, f, indent=2)
                            
                            print(f"  ✓ Saved variety: {variety_transformed['name']} (#{variety_id})")
                            
                            # Update index
                            update_index(variety_transformed, index_path)
                    except Exception as e:
                        print(f"  ✗ Error fetching variety: {e}")
            
        except Exception as e:
            print(f"✗ Error processing Pokémon #{pokemon_id}: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n✓ Done! Pokémon data saved to {base_dir}/")
    print(f"✓ Index updated: {index_path}")

if __name__ == "__main__":
    main()

