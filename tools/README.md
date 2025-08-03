# Tannenbaumbiel - Testing Tools

This directory contains testing tools and scripts for the Tannenbaumbiel game project.

## Selenium Integration Test

The Selenium integration test verifies that the frontend game loads correctly and can be interacted with after the Docker Compose setup starts.

### What the test does:

1. **Service Health Check**: Waits for all Docker Compose services (frontend, backend, database) to be ready
2. **Frontend Loading**: Verifies the game loads correctly in a browser
3. **UI Interaction**: Tests filling in the username and room name inputs
4. **Game Start**: Attempts to start a game by clicking the "Spiel Starten" button
5. **Error Detection**: Checks for JavaScript errors and error messages
6. **Screenshots**: Takes screenshots during the test for debugging

### Running the Test

#### Option 1: Using the provided script (Recommended)

```bash
# From the project root directory
cd tools

# Normal headless mode (automated)
./run_test.sh

# Debug mode with visible browser
./run_test.sh --debug

# Or use the convenience debug script
./test_debug.sh
```

This script will:

- Start Docker Compose services if not running
- Create a Python virtual environment
- Install test dependencies
- Run the Selenium test

#### Option 2: Using Docker Compose

```bash
# From the project root directory
# First, make sure the main services are running
docker compose up -d

# Run the test service
docker compose run --rm test
```

#### Option 3: Manual setup

```bash
# From the tools directory
cd tools

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r test_requirements.txt

# Make sure Docker Compose services are running
cd ..
docker compose up -d
cd tools

# Run the test (headless)
python selenium_test.py

# Or run in debug mode
python selenium_test.py --debug
```

### Debug Mode

Debug mode provides an interactive testing experience where you can watch the browser perform each action:

**Features:**

- **Visible Browser**: Chrome runs in windowed mode instead of headless
- **Interactive Pauses**: Test pauses at each major step, waiting for you to press Enter
- **Slower Execution**: Longer delays between actions for easier observation
- **Step-by-Step Guidance**: Detailed messages explaining what to look for at each step
- **Mouse Movement Visualization**: You can see exactly where clicks occur

**Usage:**

```bash
# Easy debug mode
./test_debug.sh

# Or with the main script
./run_test.sh --debug

# Or directly with Python
python selenium_test.py --debug
```

**What you'll see in debug mode:**

1. Browser window opens and maximizes
2. Navigates to the game frontend
3. Pauses to let you see the loading screen
4. Waits for game to load completely
5. Shows you the username input being filled
6. Shows you the room name input being filled
7. Highlights where the "Spiel Starten" button will be clicked
8. Shows the game response after clicking
9. Final review of all changes

### Test Output

The test will produce:

- Detailed console logs showing each step
- Screenshots saved as PNG files:
  - `before_game_start.png` - Screenshot before clicking start button
  - `after_game_start.png` - Screenshot after clicking start button
  - `test_failure.png` - Screenshot if test fails (only on failure)

### Dependencies

The test requires:

- Python 3.11+
- Chrome browser (installed automatically in Docker)
- The following Python packages (in `test_requirements.txt`):
  - selenium
  - webdriver-manager
  - requests
  - pytest

### Troubleshooting

**Test fails with "Services not ready":**

- Make sure Docker Compose services are running: `docker compose up -d`
- Check service health: `docker compose ps`
- Wait longer for services to start (especially on slower systems)

**Chrome/WebDriver issues:**

- The Docker version installs Chrome automatically
- For local testing, Chrome will be downloaded automatically by webdriver-manager

**Frontend not loading:**

- Check if frontend is accessible: http://localhost:3000
- Check backend health: http://localhost:8000
- Review Docker logs: `docker compose logs frontend`

**Game interaction issues:**

- The test clicks on canvas coordinates, which may vary with screen size
- Screenshots can help debug where clicks are happening
- Check browser console logs in the test output
- Use debug mode (`./run_test.sh --debug`) to see exactly where clicks occur

### Integration with CI/CD

This test can be integrated into CI/CD pipelines:

```bash
# Example CI script
docker compose up -d
docker compose run --rm test
docker compose down
```

### Future Improvements

Potential enhancements:

- More comprehensive game state verification
- Mobile browser testing
- Performance metrics collection
- Multi-browser testing
- Automated screenshot comparison
- Test reporting and artifacts
- Video recording of test execution
- Multiple debug levels (verbose, minimal, interactive)
- Custom wait times and coordinate configuration
