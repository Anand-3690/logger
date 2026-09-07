import re

def clean_and_format_guruhari():
    print("Reading raw text...")
    with open("guruhari_raw.txt", "r", encoding="utf-8") as f:
        content = f.read()

    # Regex to catch dates like "8 August 2021", "14 JAN 2022", "5-AUG-2026"
    date_regex = re.compile(r'^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{4})')
    
    lines = content.splitlines()
    entries = []
    current_date = None
    current_text_lines = []

    for line in lines:
        line_str = line.strip()
        if not line_str:
            continue
        
        match = date_regex.match(line_str)
        if match:
            if current_date:
                entries.append((current_date, " ".join(current_text_lines)))
            current_date = line_str
            current_text_lines = []
        else:
            if current_date:
                current_text_lines.append(line_str)

    if current_date:
        entries.append((current_date, " ".join(current_text_lines)))

    cleaned_entries = []
    
    for date_str, raw_text in entries:
        # Collapse multiple tabs/spaces into single space
        text = re.sub(r'[ \t]+', ' ', raw_text)
        
        # Iteratively remove artificial spaces between Gujarati Unicode characters
        old_text = ""
        while text != old_text:
            old_text = text
            text = re.sub(r'([\u0A80-\u0AFF]) ([\u0A80-\u0AFF])', r'\1\2', text)
            
        # Clean up double spaces left behind
        text = re.sub(r'\s+', ' ', text).strip()
        cleaned_entries.append((date_str, text))

    # Save to a clean file for Node.js to read
    with open("guruhari_cleaned_final.txt", "w", encoding="utf-8") as f:
        for date_str, text in cleaned_entries:
            f.write(f"{date_str}:::{text}\n")

    print(f"✅ Successfully cleaned {len(cleaned_entries)} entries into 'guruhari_cleaned_final.txt'")

if __name__ == "__main__":
    clean_and_format_guruhari()