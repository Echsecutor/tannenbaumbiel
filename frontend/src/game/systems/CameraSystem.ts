/**
 * CameraSystem - Handles side-scrolling camera management
 */
import Phaser from 'phaser'

export class CameraSystem {
    private scene: Phaser.Scene
    private player: Phaser.Physics.Arcade.Sprite | null = null
    private cameraDeadZone: number = 200
    private leftBoundary: number = -2000
    private rightBoundary: number = 12000
    private lastCameraX: number = 0

    constructor(scene: Phaser.Scene) {
        this.scene = scene
    }

    setupSideScrollingCamera(player: Phaser.Physics.Arcade.Sprite) {
        this.player = player
        
        // Setup camera to follow player with dead zone
        this.scene.cameras.main.startFollow(this.player, true, 0.05, 0.05)
        this.scene.cameras.main.setDeadzone(this.cameraDeadZone, this.scene.scale.height)
        
        // Set camera bounds to allow scrolling across extended world
        this.scene.cameras.main.setBounds(
            this.leftBoundary, 
            0, 
            this.rightBoundary - this.leftBoundary, 
            this.scene.scale.height
        )
        
        console.log('📷 Side-scrolling camera setup completed')
    }

    updateSideScrollingCamera(): boolean {
        const currentCameraX = this.scene.cameras.main.scrollX
        
        // Only update if camera has moved significantly
        if (Math.abs(currentCameraX - this.lastCameraX) > 10) {
            this.lastCameraX = currentCameraX
            return true // Camera moved significantly
        }
        
        return false // No significant movement
    }

    getCenterPosition(): { x: number, y: number } {
        const camera = this.scene.cameras.main
        return {
            x: camera.centerX,
            y: camera.centerY
        }
    }

    getCurrentScrollX(): number {
        return this.scene.cameras.main.scrollX
    }

    setBounds(left: number, top: number, width: number, height: number) {
        this.scene.cameras.main.setBounds(left, top, width, height)
        this.leftBoundary = left
        this.rightBoundary = left + width
    }

    setDeadzone(width: number, height: number) {
        this.cameraDeadZone = width
        this.scene.cameras.main.setDeadzone(width, height)
    }

    stopFollow() {
        this.scene.cameras.main.stopFollow()
    }

    startFollow(target: Phaser.GameObjects.GameObject, roundPixels?: boolean, lerpX?: number, lerpY?: number) {
        this.scene.cameras.main.startFollow(target, roundPixels, lerpX, lerpY)
    }

    setZoom(zoom: number) {
        this.scene.cameras.main.setZoom(zoom)
    }

    fadeIn(duration: number = 1000, callback?: Function) {
        this.scene.cameras.main.fadeIn(duration, 0, 0, 0, callback)
    }

    fadeOut(duration: number = 1000, callback?: Function) {
        this.scene.cameras.main.fadeOut(duration, 0, 0, 0, callback)
    }

    shake(duration: number = 500, intensity: number = 0.02) {
        this.scene.cameras.main.shake(duration, intensity)
    }

    flash(duration: number = 250, red: number = 255, green: number = 255, blue: number = 255) {
        this.scene.cameras.main.flash(duration, red, green, blue)
    }
}