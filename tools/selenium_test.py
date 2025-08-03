#!/usr/bin/env python3
"""
Selenium Integration Test for Tannenbaumbiel
Tests the frontend game flow after Docker Compose services are ready.
"""

import time
import sys
import argparse
import requests
import logging
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class TannenbaumGameTest:
    def __init__(self, debug_mode=False, visible_mode=False):
        self.driver = None
        self.frontend_url = "http://localhost:3000"
        self.backend_url = "http://localhost:8000"
        self.debug_mode = debug_mode
        self.visible_mode = visible_mode

        if self.debug_mode:
            logger.info("🔍 Debug mode enabled - browser will be visible with slower interactions and manual pauses")
        elif self.visible_mode:
            logger.info("👁️ Visible mode enabled - browser will be visible with slower interactions but no manual pauses")
        else:
            logger.info("🚀 Running in headless mode for automated testing")

    def wait_for_services(self, max_wait_time=180):
        """Wait for Docker Compose services to be ready"""
        logger.info("Waiting for services to be ready...")

        start_time = time.time()
        services = {
            "Backend": f"{self.backend_url}/",
            "Frontend": self.frontend_url
        }

        while time.time() - start_time < max_wait_time:
            all_ready = True

            for service_name, url in services.items():
                try:
                    response = requests.get(url, timeout=5)
                    if response.status_code == 200:
                        logger.info(f"✓ {service_name} is ready")
                    else:
                        logger.info(f"⧗ {service_name} responded with status {response.status_code}")
                        all_ready = False
                except requests.exceptions.RequestException as e:
                    logger.info(f"⧗ {service_name} not ready: {e}")
                    all_ready = False

            if all_ready:
                logger.info("🎉 All services are ready!")
                return True

            time.sleep(5)

        logger.error(f"❌ Services not ready after {max_wait_time} seconds")
        return False

    def setup_driver(self):
        """Setup Chrome WebDriver"""
        logger.info("Setting up Chrome WebDriver...")

        chrome_options = Options()

        # Configure Chrome based on debug/visible mode
        if not self.debug_mode and not self.visible_mode:
            chrome_options.add_argument("--headless")  # Run in headless mode only if not debugging or visible
            logger.info("Running in headless mode")
        else:
            logger.info("Running in visible mode")

        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")

        if not self.debug_mode and not self.visible_mode:
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--disable-extensions")
            chrome_options.add_argument("--disable-plugins")

        # Install and setup ChromeDriver with robust path handling
        try:
            import os
            import stat

            # Try to get chromedriver path
            try:
                chromedriver_path = ChromeDriverManager().install()
                logger.info(f"WebDriver manager returned: {chromedriver_path}")
            except Exception as e:
                logger.warning(f"WebDriver manager failed: {e}")
                chromedriver_path = None

            # Always search for the actual chromedriver executable
            if chromedriver_path:
                search_dirs = [
                    os.path.dirname(chromedriver_path),
                    os.path.expanduser("~/.wdm/drivers/chromedriver")
                ]
            else:
                search_dirs = [os.path.expanduser("~/.wdm/drivers/chromedriver")]

            actual_chromedriver = None
            for search_dir in search_dirs:
                if os.path.exists(search_dir):
                    for root, dirs, files in os.walk(search_dir):
                        for file in files:
                            if file == 'chromedriver':
                                potential_path = os.path.join(root, file)
                                # Make sure the file is executable
                                try:
                                    os.chmod(potential_path, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
                                    if os.access(potential_path, os.X_OK):
                                        actual_chromedriver = potential_path
                                        logger.info(f"Found and prepared chromedriver at: {actual_chromedriver}")
                                        break
                                except OSError:
                                    continue
                        if actual_chromedriver:
                            break
                if actual_chromedriver:
                    break

            if not actual_chromedriver:
                raise Exception("Could not find a valid chromedriver executable")

            service = Service(actual_chromedriver)
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.implicitly_wait(10)

            if self.debug_mode or self.visible_mode:
                # Maximize window for better visibility
                self.driver.maximize_window()
                mode_name = "debug mode" if self.debug_mode else "visible mode"
                logger.info(f"✓ Chrome WebDriver setup successful ({mode_name} - window maximized)")
            else:
                logger.info("✓ Chrome WebDriver setup successful")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to setup Chrome WebDriver: {e}")
            return False

    def debug_pause(self, message="Press Enter to continue..."):
        """Pause execution in debug mode for manual inspection"""
        if self.debug_mode:
            input(f"🔍 DEBUG: {message}")
        elif self.visible_mode:
            # In visible mode, just log the message but don't pause
            logger.info(f"👁️ VISIBLE: {message}")

    def debug_sleep(self, seconds=2):
        """Sleep for longer periods in debug/visible mode for better visibility"""
        if self.debug_mode or self.visible_mode:
            time.sleep(seconds * 2)  # Double the wait time for better visibility
        else:
            time.sleep(seconds)

    def log_current_game_state(self, context=""):
        """Log the current game state for debugging purposes"""
        try:
            game_state = self.driver.execute_script("""
                let state = { 
                    currentScene: null, 
                    menuSceneActive: false, 
                    gameSceneActive: false,
                    buttonExists: false,
                    buttonInteractive: false,
                    inputValues: { username: '', room: '' }
                };
                
                if (window.game && window.game.scene) {
                    // Get currently active scenes
                    const activeScenes = window.game.scene.getScenes(true);
                    const sceneKeys = activeScenes.map(scene => scene.scene.key);
                    state.currentScene = sceneKeys.join(', ');
                    
                    // Check specific scenes
                    state.menuSceneActive = sceneKeys.includes('MenuScene');
                    state.gameSceneActive = sceneKeys.includes('GameScene');
                    
                    // Check button state
                    const menuScene = window.game.scene.getScene('MenuScene');
                    if (menuScene && menuScene.joinButton) {
                        state.buttonExists = true;
                        state.buttonInteractive = menuScene.joinButton.input ? menuScene.joinButton.input.enabled : false;
                    }
                }
                
                // Get input values
                const usernameInput = document.querySelector('input[placeholder="Dein Name"]');
                const roomInput = document.querySelector('input[placeholder="Winterwald"]');
                if (usernameInput) state.inputValues.username = usernameInput.value;
                if (roomInput) state.inputValues.room = roomInput.value;
                
                return state;
            """)

            logger.info(f"🎮 Game state {context}: {game_state}")

        except Exception as e:
            logger.warning(f"⚠ Failed to log game state {context}: {e}")

    def verify_button_click_success(self):
        """Verify that the button click actually worked by checking game state changes"""
        try:
            # Check multiple indicators that the button click worked
            game_state = self.driver.execute_script("""
                let state = { 
                    currentScene: null, 
                    menuSceneActive: false, 
                    gameSceneActive: false,
                    offlineMode: false,
                    networkActivity: false
                };
                
                if (window.game && window.game.scene) {
                    // Get currently active scenes
                    const activeScenes = window.game.scene.getScenes(true);
                    const sceneKeys = activeScenes.map(scene => scene.scene.key);
                    state.currentScene = sceneKeys.join(', ');
                    
                    // Check specific scenes
                    state.menuSceneActive = sceneKeys.includes('MenuScene');
                    state.gameSceneActive = sceneKeys.includes('GameScene');
                    
                    // Check if we're in offline mode
                    const gameScene = window.game.scene.getScene('GameScene');
                    if (gameScene && gameScene.sys.settings && gameScene.sys.settings.data) {
                        state.offlineMode = gameScene.sys.settings.data.offline === true;
                    }
                    
                    // Check for recent network activity (if connected)
                    if (window.networkManager) {
                        state.networkActivity = window.networkManager.getConnectionStatus();
                    }
                }
                
                console.log('Game state check:', state);
                return state;
            """)

            logger.info(f"🎮 Game state: {game_state}")

            # Button click was successful if:
            # 1. We moved from MenuScene to GameScene, OR
            # 2. We're in offline mode (which means the button triggered offline game start)
            success = (
                game_state['gameSceneActive'] or
                game_state['offlineMode'] or
                not game_state['menuSceneActive']  # Menu scene is no longer active
            )

            return success

        except Exception as e:
            logger.error(f"❌ Failed to verify button click: {e}")
            return False

    def check_connection_status(self):
        """Check the connection status displayed in both HTML element and game text"""
        try:
            # Check HTML connection status element
            connection_status = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "connection-status"))
            )

            status_text = connection_status.text
            status_class = connection_status.get_attribute("class")

            logger.info(f"📱 HTML Connection status: '{status_text}' (class: {status_class})")

            # Check if the element is visible on screen
            is_displayed = connection_status.is_displayed()
            location = connection_status.location
            size = connection_status.size
            logger.info(f"📱 HTML status element - displayed: {is_displayed}, location: {location}, size: {size}")

            # Try to get Phaser game status from console logs or by executing script
            try:
                game_status_info = self.driver.execute_script("""
                    // Try to get status from active scenes
                    let statusInfo = [];
                    if (window.game && window.game.scene) {
                        const scenes = window.game.scene.getScenes(true);
                        scenes.forEach(scene => {
                            if (scene.connectionStatus && scene.connectionStatus.text) {
                                statusInfo.push({
                                    scene: scene.scene.key,
                                    text: scene.connectionStatus.text,
                                    color: scene.connectionStatus.style ? scene.connectionStatus.style.color : 'unknown'
                                });
                            }
                            if (scene.connectionText && scene.connectionText.text) {
                                statusInfo.push({
                                    scene: scene.scene.key + '_UI',
                                    text: scene.connectionText.text,
                                    color: scene.connectionText.style ? scene.connectionText.style.color : 'unknown'
                                });
                            }
                        });
                    }
                    return statusInfo;
                """)

                logger.info(f"🎮 Game status indicators: {game_status_info}")

                # Check if any game indicators show different status than HTML
                html_connected = "Verbindung: Verbunden" in status_text and "connected" in status_class

                for game_status in game_status_info:
                    game_connected = "Verbunden" in game_status['text'] or "Online: Verbunden" in game_status['text']
                    if html_connected != game_connected:
                        logger.warning(f"⚠️ STATUS MISMATCH! HTML: {html_connected}, Game ({game_status['scene']}): {game_connected}")
                        logger.warning(f"   HTML text: '{status_text}', Game text: '{game_status['text']}'")

            except Exception as e:
                logger.warning(f"⚠️ Could not check game status indicators: {e}")

            # Determine overall status based on HTML element (primary source)
            if "Verbindung: Verbunden" in status_text and "connected" in status_class:
                logger.info("✅ HTML Connection status shows as CONNECTED")
                return True
            elif "Verbindung: Getrennt" in status_text and "disconnected" in status_class:
                logger.warning("⚠️ HTML Connection status shows as DISCONNECTED - backend may not be reachable")
                return False
            else:
                logger.warning(f"⚠️ Unexpected HTML connection status: '{status_text}' with class '{status_class}'")
                return False

        except Exception as e:
            logger.error(f"❌ Failed to check connection status: {e}")
            return False

    def test_frontend_loading(self):
        """Test that the frontend loads correctly"""
        logger.info("Testing frontend loading...")

        try:
            self.driver.get(self.frontend_url)
            self.debug_pause("Navigate to frontend. Loading screen should appear.")

            # Wait for the loading screen to appear first
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "loading"))
            )
            logger.info("✓ Loading screen appeared")
            self.debug_pause("Loading screen is visible. Wait for it to disappear...")

            # Wait for the loading screen to disappear (game loaded)
            WebDriverWait(self.driver, 30).until_not(
                EC.visibility_of_element_located((By.ID, "loading"))
            )
            logger.info("✓ Game loaded (loading screen disappeared)")
            self.debug_pause("Game has loaded! You should see the menu scene.")

            # Check that the game container is present
            game_container = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "game-container"))
            )
            logger.info("✓ Game container found")

            # Check page title
            expected_title = "Tannenbaumbiel - Ein magisches Winterabenteuer"
            if self.driver.title == expected_title:
                logger.info("✓ Page title is correct")
            else:
                logger.warning(f"⚠ Page title mismatch. Expected: '{expected_title}', Got: '{self.driver.title}'")

            # Check connection status element
            self.check_connection_status()

            # Take a screenshot to see both status indicators
            if self.debug_mode or self.visible_mode:
                screenshot_path = "debug_connection_status.png"
                self.driver.save_screenshot(screenshot_path)
                logger.info(f"📸 Screenshot saved: {screenshot_path} - Check for both status indicators")

            self.debug_pause("Frontend loading test complete. Game should be visible with menu. Check both status indicators (top-left game text and top-right HTML element).")

            return True

        except Exception as e:
            logger.error(f"❌ Frontend loading test failed: {e}")
            return False

    def test_game_interaction(self):
        """Test basic game interactions"""
        logger.info("Testing game interactions...")

        try:
            # Wait a bit for the menu scene to fully load
            self.debug_sleep(3)
            self.debug_pause("Menu scene should be loaded. Look for username and room inputs.")

            # Find and fill the username input
            username_input = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "input[placeholder='Dein Name']"))
            )
            username_input.clear()
            self.debug_sleep(1)
            username_input.send_keys("TestPlayer")
            logger.info("✓ Username input filled")
            self.debug_pause("Username 'TestPlayer' entered. Look at the username field.")

            # Find and fill the room name input
            room_input = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "input[placeholder='Winterwald']"))
            )
            room_input.clear()
            self.debug_sleep(1)
            room_input.send_keys("TestRoom")
            logger.info("✓ Room name input filled")
            self.debug_pause("Room name 'TestRoom' entered. Both fields should be filled now.")

            # Log the current game state before clicking
            self.log_current_game_state("before button click")

            # Take a screenshot before clicking start
            self.driver.save_screenshot("before_game_start.png")
            logger.info("✓ Screenshot saved: before_game_start.png")
            self.debug_pause("Screenshot taken. Ready to click the 'Spiel Starten' button.")

            # Find and click the "Spiel Starten" button
            # We need to click on the Phaser canvas element that contains the button
            # Since it's a Phaser game, we'll try multiple approaches to ensure the click works
            canvas = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "canvas"))
            )

            # First, try to get the actual button position from the game
            button_info = self.driver.execute_script("""
                // Try to get button position from the MenuScene
                let buttonInfo = { found: false, x: 0, y: 0, gameWidth: 0, gameHeight: 0 };
                if (window.game && window.game.scene) {
                    const menuScene = window.game.scene.getScene('MenuScene');
                    if (menuScene && menuScene.joinButton) {
                        const button = menuScene.joinButton;
                        buttonInfo.found = true;
                        buttonInfo.x = button.x;
                        buttonInfo.y = button.y;
                        buttonInfo.gameWidth = menuScene.scale.width;
                        buttonInfo.gameHeight = menuScene.scale.height;
                        console.log('Button found at game coordinates:', buttonInfo);
                    }
                }
                return buttonInfo;
            """)

            if button_info['found']:
                logger.info(f"✓ Found button at game coordinates: x={button_info['x']}, y={button_info['y']}")
                logger.info(f"  Game dimensions: {button_info['gameWidth']}x{button_info['gameHeight']}")

                # Convert game coordinates to canvas coordinates
                canvas_size = canvas.size
                scale_x = canvas_size['width'] / button_info['gameWidth']
                scale_y = canvas_size['height'] / button_info['gameHeight']

                click_x = int(button_info['x'] * scale_x)
                click_y = int(button_info['y'] * scale_y)

                logger.info(f"  Canvas size: {canvas_size['width']}x{canvas_size['height']}")
                logger.info(f"  Scale factors: x={scale_x:.2f}, y={scale_y:.2f}")
                logger.info(f"  Calculated canvas click position: x={click_x}, y={click_y}")
            else:
                logger.warning("⚠ Could not find button in game - using fallback coordinates")
                # Fallback to original approach but more precise
                canvas_size = canvas.size
                click_x = canvas_size['width'] // 2
                click_y = 500  # Use the exact y-coordinate from MenuScene code
                logger.info(f"  Using fallback coordinates: x={click_x}, y={click_y}")

            # Try clicking via JavaScript first (more reliable)
            try:
                click_result = self.driver.execute_script("""
                    const canvas = document.querySelector('canvas');
                    if (canvas && window.game && window.game.scene) {
                        const menuScene = window.game.scene.getScene('MenuScene');
                        if (menuScene && menuScene.joinButton) {
                            // Simulate a click on the button directly
                            menuScene.joinButton.emit('pointerdown');
                            console.log('Button clicked via JavaScript');
                            return { success: true, method: 'javascript' };
                        }
                    }
                    return { success: false, method: 'javascript' };
                """)

                if click_result['success']:
                    logger.info("✓ Successfully clicked button via JavaScript")
                else:
                    raise Exception("JavaScript click failed")

            except Exception as js_error:
                logger.warning(f"⚠ JavaScript click failed: {js_error}, trying Selenium click")

                # Fallback to Selenium click
                from selenium.webdriver.common.action_chains import ActionChains
                actions = ActionChains(self.driver)
                actions.move_to_element_with_offset(canvas, click_x - canvas_size['width'] // 2, click_y - canvas_size['height'] // 2)

                if self.debug_mode:
                    logger.info(f"About to click at coordinates: x={click_x}, y={click_y}")
                    self.debug_pause("Watch the mouse cursor move to the button area and click.")

                actions.click()
                actions.perform()
                logger.info("✓ Clicked game start button area via Selenium")

            # Wait a moment for the game to respond
            self.debug_sleep(3)

            # Log the game state after clicking
            self.log_current_game_state("after button click")

            # Verify that the button click worked by checking game state
            click_success = self.verify_button_click_success()
            if click_success:
                logger.info("✅ Button click verified - game state changed successfully")
            else:
                logger.warning("⚠ Button click may not have worked - no game state change detected")

            self.debug_pause("Game start button clicked. Observe any changes in the game.")

            # Take a screenshot after clicking start
            self.driver.save_screenshot("after_game_start.png")
            logger.info("✓ Screenshot saved: after_game_start.png")
            self.debug_pause("Second screenshot taken. Check for any game state changes.")

            # Check connection status after game interaction
            connection_ok = self.check_connection_status()
            if not connection_ok:
                logger.warning("⚠ Connection issues detected after game interaction")

            # Check if there are any error messages visible
            try:
                error_element = self.driver.find_element(By.ID, "error-message")
                if error_element.is_displayed():
                    error_text = error_element.text
                    logger.warning(f"⚠ Error message displayed: {error_text}")
                else:
                    logger.info("✓ No error messages displayed")
            except:
                logger.info("✓ No error messages found")

            # Check console logs for any JavaScript errors
            logs = self.driver.get_log('browser')
            error_logs = [log for log in logs if log['level'] == 'SEVERE']
            if error_logs:
                logger.warning("⚠ JavaScript errors found:")
                for log in error_logs:
                    logger.warning(f"  {log['message']}")
            else:
                logger.info("✓ No JavaScript errors in console")

            self.debug_pause("Game interaction test complete. Review the final state.")
            return True

        except Exception as e:
            logger.error(f"❌ Game interaction test failed: {e}")
            # Take a screenshot on failure
            try:
                self.driver.save_screenshot("test_failure.png")
                logger.info("✓ Failure screenshot saved: test_failure.png")
            except:
                pass
            return False

    def cleanup(self):
        """Clean up resources"""
        if self.driver:
            if self.debug_mode:
                self.debug_pause("Test complete! Browser will close after pressing Enter.")
            elif self.visible_mode:
                logger.info("👁️ VISIBLE: Test complete! Browser will close in 3 seconds...")
                time.sleep(3)
            self.driver.quit()
            logger.info("✓ WebDriver closed")

    def run_test(self):
        """Run the complete test suite"""
        logger.info("🎮 Starting Tannenbaum Game Integration Test")

        # Step 1: Wait for services
        if not self.wait_for_services():
            logger.error("❌ Test failed: Services not ready")
            return False

        # Step 2: Setup WebDriver
        if not self.setup_driver():
            logger.error("❌ Test failed: WebDriver setup failed")
            return False

        try:
            # Step 3: Test frontend loading
            if not self.test_frontend_loading():
                logger.error("❌ Test failed: Frontend loading failed")
                return False

            # Step 4: Test game interactions
            if not self.test_game_interaction():
                logger.error("❌ Test failed: Game interaction failed")
                return False

            logger.info("🎉 All tests passed!")
            return True

        finally:
            self.cleanup()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Tannenbaum Game Selenium Integration Test')
    parser.add_argument('--debug', '-d', action='store_true',
                        help='Run in debug mode with visible browser and interactive pauses')
    parser.add_argument('--visible', '-v', action='store_true',
                        help='Run with visible browser but no interactive pauses')

    args = parser.parse_args()

    # Ensure debug and visible are not both specified
    if args.debug and args.visible:
        logger.error("❌ Cannot specify both --debug and --visible modes")
        parser.print_help()
        sys.exit(1)

    test = TannenbaumGameTest(debug_mode=args.debug, visible_mode=args.visible)
    success = test.run_test()

    if success:
        logger.info("✅ Selenium test completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Selenium test failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
