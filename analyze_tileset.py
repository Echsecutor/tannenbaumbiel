#!/usr/bin/env python3
"""
Enhanced Tileset analyzer for Season_collection.png
Uses OpenCV and scikit-image for advanced object recognition and pattern detection
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import sys
import os
from skimage import feature, measure, segmentation
from skimage.color import rgb2gray


def analyze_tileset(image_path):
    """Analyze the tileset using advanced computer vision techniques"""

    # Load the image with OpenCV and PIL
    cv_img = cv2.imread(image_path)
    pil_img = Image.open(image_path)

    if cv_img is None:
        print(f"Error: Could not load image {image_path}")
        return

    height, width = cv_img.shape[:2]
    print(f"Image size: {width}x{height} (width x height)")

    # Convert to RGB for processing
    cv_img_rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)

    print("\n=== ADVANCED TILE BOUNDARY DETECTION ===")

    # 1. Edge detection using Canny
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)

    # 2. Line detection using Hough Transform
    lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=200)

    horizontal_lines = []
    vertical_lines = []

    if lines is not None:
        for rho, theta in lines[:, 0]:
            # Classify lines as horizontal or vertical
            angle = theta * 180 / np.pi
            if abs(angle) < 10 or abs(angle - 180) < 10:  # Horizontal lines
                y = int(rho / np.sin(theta)) if np.sin(theta) != 0 else None
                if y and 0 < y < height:
                    horizontal_lines.append(y)
            elif abs(angle - 90) < 10:  # Vertical lines
                x = int(rho / np.cos(theta)) if np.cos(theta) != 0 else None
                if x and 0 < x < width:
                    vertical_lines.append(x)

    print(f"Detected {len(horizontal_lines)} horizontal grid lines")
    print(f"Detected {len(vertical_lines)} vertical grid lines")

    # 3. Template matching for common tile sizes
    print("\n=== TILE SIZE ANALYSIS ===")

    # Check if image dimensions fit common tile sizes
    common_sizes = [16, 32, 48, 64]
    best_tile_size = None

    for size in common_sizes:
        h_tiles = height // size
        v_tiles = width // size
        h_remainder = height % size
        v_remainder = width % size

        print(f"  {size}x{size}: {v_tiles}x{h_tiles} tiles (remainder: {v_remainder}x{h_remainder})")

        if h_remainder == 0 and v_remainder == 0:
            best_tile_size = size
            print(f"    ✓ Perfect fit for {size}x{size} tiles!")

    # 4. Color-based segmentation to identify distinct regions
    print("\n=== WINTER-THEMED REGION DETECTION ===")

    # Convert to LAB color space for better color analysis
    lab_img = cv2.cvtColor(cv_img_rgb, cv2.COLOR_RGB2LAB)

    # Define winter color ranges (blues, whites, light grays)
    # In LAB: L=lightness, A=green-red, B=blue-yellow
    winter_regions = []

    # Create masks for winter colors
    # High lightness (whites/light colors)
    white_mask = lab_img[:, :, 0] > 180

    # Blue tones (negative B values)
    blue_mask = lab_img[:, :, 2] < 110

    # Combine masks
    winter_mask = white_mask | blue_mask

    # Find connected components
    num_labels, labels = cv2.connectedComponents(winter_mask.astype(np.uint8))

    # Analyze each region
    for label in range(1, num_labels):
        region_mask = (labels == label)
        region_area = np.sum(region_mask)

        if region_area > 500:  # Filter small regions
            # Get bounding box
            coords = np.where(region_mask)
            y_min, y_max = coords[0].min(), coords[0].max()
            x_min, x_max = coords[1].min(), coords[1].max()

            # Calculate winter score based on color properties
            region_pixels = cv_img_rgb[region_mask]
            avg_color = np.mean(region_pixels, axis=0)
            brightness = np.mean(avg_color)
            blue_ratio = avg_color[2] / (np.sum(avg_color) + 1e-6)

            winter_score = brightness * 0.6 + blue_ratio * 100 * 0.4

            winter_regions.append({
                'bbox': (x_min, y_min, x_max, y_max),
                'area': region_area,
                'avg_color': avg_color,
                'winter_score': winter_score
            })

    # Sort by winter score
    winter_regions.sort(key=lambda x: x['winter_score'], reverse=True)

    print(f"Found {len(winter_regions)} potential winter regions")

    # 5. Extract and save tile samples
    print("\n=== EXTRACTING TILE SAMPLES ===")

    if best_tile_size:
        tile_size = best_tile_size
        print(f"Using detected tile size: {tile_size}x{tile_size}")
    else:
        tile_size = 32  # Default
        print(f"Using default tile size: {tile_size}x{tile_size}")

    # Extract tiles in a grid pattern
    tiles_extracted = 0
    rows = height // tile_size
    cols = width // tile_size

    print(f"Grid: {cols} columns x {rows} rows")

    # Focus on areas that might contain winter tiles
    # Based on your description: "second row middle" and "lower right"

    # Second row middle area
    if rows >= 2:
        middle_start = cols // 4
        middle_end = 3 * cols // 4
        row = 1  # Second row (0-indexed)

        print(f"\nExtracting from second row middle (row {row}, cols {middle_start}-{middle_end}):")
        for col in range(middle_start, min(middle_end, cols)):
            x = col * tile_size
            y = row * tile_size

            tile = pil_img.crop((x, y, x + tile_size, y + tile_size))
            filename = f'tile_second_row_middle_{col}.png'
            tile.save(filename)
            print(f"  Saved: {filename} (position {x},{y})")
            tiles_extracted += 1

    # Lower right area
    if rows >= 8 and cols >= 8:  # Ensure we have enough space
        lr_rows = min(8, rows - 2)  # Take bottom 8 rows (or available)
        lr_cols = min(11, cols - 2)  # Take right 11 columns (352px / 32px = 11)

        start_row = rows - lr_rows
        start_col = cols - lr_cols

        print(f"\nExtracting from lower right area (rows {start_row}-{rows - 1}, cols {start_col}-{cols - 1}):")

        # Extract as a single background image
        bg_x = start_col * tile_size
        bg_y = start_row * tile_size
        bg_width = lr_cols * tile_size
        bg_height = lr_rows * tile_size

        background = pil_img.crop((bg_x, bg_y, bg_x + bg_width, bg_y + bg_height))
        background.save('winter_background_detected.png')
        print(f"  Saved: winter_background_detected.png ({bg_width}x{bg_height} at {bg_x},{bg_y})")

        # Also extract individual tiles from this area
        for row in range(start_row, min(start_row + 4, rows)):  # Sample first 4 rows
            for col in range(start_col, min(start_col + 6, cols)):  # Sample first 6 cols
                x = col * tile_size
                y = row * tile_size

                tile = pil_img.crop((x, y, x + tile_size, y + tile_size))
                filename = f'tile_lower_right_{row - start_row}_{col - start_col}.png'
                tile.save(filename)
                tiles_extracted += 1

    # 6. Create visualization
    print(f"\n=== CREATING VISUALIZATION ===")

    # Create a copy for visualization
    vis_img = cv_img_rgb.copy()

    # Draw grid lines
    if best_tile_size:
        tile_size = best_tile_size
        for i in range(0, width, tile_size):
            cv2.line(vis_img, (i, 0), (i, height), (255, 0, 0), 1)
        for i in range(0, height, tile_size):
            cv2.line(vis_img, (0, i), (width, i), (255, 0, 0), 1)

    # Highlight winter regions
    for i, region in enumerate(winter_regions[:5]):  # Top 5
        x1, y1, x2, y2 = region['bbox']
        color = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255)][i]
        cv2.rectangle(vis_img, (x1, y1), (x2, y2), color, 3)
        cv2.putText(vis_img, f'{i + 1}', (x1 + 5, y1 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    # Save visualization
    cv2.imwrite('tileset_analysis_visualization.png', cv2.cvtColor(vis_img, cv2.COLOR_RGB2BGR))

    print(f"Extracted {tiles_extracted} tile samples")
    print("Saved visualization: tileset_analysis_visualization.png")

    print(f"\n=== SUMMARY ===")
    print(f"Best tile size detected: {best_tile_size or 'Unknown (using 32x32)'}x{best_tile_size or 32}")
    print(f"Winter regions found: {len(winter_regions)}")
    if winter_regions:
        print(f"Best winter region score: {winter_regions[0]['winter_score']:.1f}")

    return {
        'tile_size': best_tile_size or 32,
        'winter_regions': winter_regions,
        'grid_lines': {'horizontal': horizontal_lines, 'vertical': vertical_lines}
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 analyze_tileset.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} not found")
        sys.exit(1)

    result = analyze_tileset(image_path)
    print("\nAnalysis complete! Check the extracted tile files.")
