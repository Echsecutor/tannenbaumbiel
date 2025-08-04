# Image Analysis Tools

## Overview

Located in `/tools/image_analysis/` - Computer vision tools for analyzing sprite sheets and tilesets.

## Main Tool: `analyze_tileset.py`

Advanced tileset analyzer using OpenCV and scikit-image for sprite sheet analysis.

### Capabilities

- **Automated Tile Boundary Detection**: Uses Canny edge detection and Hough line transforms
- **Theme-Specific Region Detection**: Color analysis in LAB space to identify winter/seasonal themes
- **Grid Pattern Recognition**: Detects common tile sizes (16x16, 32x32, 48x48, 64x64)
- **Automatic Asset Extraction**: Extracts tiles and backgrounds based on detected patterns
- **Visual Analysis Output**: Generates annotated visualizations showing detected regions

### Dependencies

- opencv-python (4.12.0.88)
- scikit-image (0.25.2)
- Pillow (11.3.0)
- numpy (2.2.6)

### Setup and Usage

```bash
cd tools/image_analysis
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 analyze_tileset.py /path/to/tileset.png
```

## Project Context

Created for Tannenbaumbiel game to extract winter sprites from `Season_collection.png`. These tools helped identify proper tile boundaries and winter-themed regions when manual coordinate guessing failed.

## Use Cases

- **Sprite Sheet Analysis**: When you have a complex tileset and need to identify tile boundaries
- **Theme Detection**: Finding season-specific or thematic regions in large sprite collections
- **Asset Extraction**: Automatically extracting individual tiles or background images
- **Grid Analysis**: Understanding the underlying structure of sprite sheets

## Future Extensions

- Multi-theme analysis (summer, autumn, spring themes)
- Animation frame detection
- Batch processing of multiple tilesets
- Template matching for specific sprite patterns
- Integration with game asset build pipelines

## Files Structure

```
tools/image_analysis/
├── analyze_tileset.py     # Main analysis script
├── README.md             # Detailed documentation
├── requirements.txt      # Python dependencies
└── venv/                # Virtual environment (created as needed)
```

## Related Notes

- [Game Development Status](game_development_status.md) - Current implementation status
- [Repository Structure](repository_structure.md) - Overall project organization
