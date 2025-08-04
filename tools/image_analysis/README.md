# Image Analysis Tools

This directory contains computer vision tools for analyzing sprite sheets and tilesets used in game development.

## Tools Available

### `analyze_tileset.py`
Advanced tileset analyzer using OpenCV and scikit-image for:
- **Tile boundary detection** using edge detection and Hough transforms
- **Winter-themed region identification** using color analysis in LAB color space  
- **Automatic tile extraction** based on detected grid patterns
- **Visualization generation** showing detected regions and grid overlays

## Setup

1. **Activate the virtual environment:**
   ```bash
   source image_analysis_env/bin/activate
   ```

2. **Dependencies are already installed:**
   - opencv-python (4.12.0.88)
   - scikit-image (0.25.2) 
   - Pillow (11.3.0)
   - numpy (2.2.6)

## Usage

### Basic Analysis
```bash
cd tools/image_analysis
source image_analysis_env/bin/activate
python3 analyze_tileset.py /path/to/your/tileset.png
```

### Example: Analyzing Season Collection
```bash
python3 analyze_tileset.py ../../tiles/Season_collection.png
```

## Output Files

The analyzer generates several output files:

- **`tile_second_row_middle_*.png`** - Individual tiles extracted from second row middle area
- **`tile_lower_right_*_*.png`** - Individual tiles from lower right region
- **`winter_background_detected.png`** - Detected background image
- **`tileset_analysis_visualization.png`** - Visualization showing detected regions and grid

## Features

### Advanced Computer Vision
- **Canny Edge Detection** for finding tile boundaries
- **Hough Line Transform** for detecting grid patterns
- **Connected Component Analysis** for region segmentation
- **LAB Color Space Analysis** for theme-specific region detection

### Automatic Grid Detection
Analyzes common tile sizes (16x16, 32x32, 48x48, 64x64) and detects the best fit based on image dimensions.

### Theme-Specific Analysis
Uses color analysis to identify winter-themed regions:
- High lightness values (whites, light colors)
- Blue color components
- Combined scoring system for ranking regions

## Project Context

Created for the Tannenbaumbiel game project to properly extract winter-themed sprites from the Season_collection.png tileset. These tools can be reused for analyzing other sprite sheets and tilesets in future projects.

## Extension Ideas

- Template matching for specific sprite patterns
- Animation frame detection
- Multi-theme analysis (summer, autumn, etc.)
- Batch processing of multiple tilesets
- Integration with game asset pipelines