import { App, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';

// 1. Define the interface for our settings
interface DragToScrollSettings {
    mouseButton: number;
    modifierKey: 'none' | 'ctrl' | 'shift' | 'alt';
    friction: number;
}

// 2. Set the default values for the settings
const DEFAULT_SETTINGS: DragToScrollSettings = {
    mouseButton: 2, // 0:LMB, 1:MMB, 2:RMB
    modifierKey: 'none',
    friction: 0.92,
}

// Main plugin class
export default class DragToScrollPlugin extends Plugin {
    settings: DragToScrollSettings;

    isDragging: boolean = false;
    startY: number = 0;
    didDrag: boolean = false;
    lastVelocityY: number = 0;
    animationFrameId: number | null = null;
    
    private readonly DRAG_THRESHOLD = 5;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new DragToScrollSettingTab(this.app, this));

        console.log('Loading Drag to Scroll plugin');
        
        this.registerDomEvent(document, 'mousedown', this.handleMouseDown);
        this.registerDomEvent(document, 'mousemove', this.handleMouseMove);
        this.registerDomEvent(document, 'mouseup', this.handleMouseUp);
        this.registerDomEvent(document, 'contextmenu', this.handleContextMenu, { capture: true });
    }

    onunload() {
        console.log('Unloading Drag to Scroll plugin');
        document.body.classList.remove('is-dragging-to-scroll');
        this.stopInertiaScroll();
    }

    async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

    getScrollableElement = (): HTMLElement | null => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return null;
        const mode = view.getMode();
        const container = view.containerEl;
        if (mode === 'source') return container.querySelector<HTMLElement>('.cm-scroller');
        if (mode === 'preview') return container.querySelector<HTMLElement>('.markdown-preview-view');
        return null;
    }
    
    handleMouseDown = (evt: MouseEvent) => {
        if (evt.button !== this.settings.mouseButton) return;

        const mod = this.settings.modifierKey;
        const isModKeyPressed = evt.ctrlKey || evt.altKey || evt.shiftKey;

        if ((mod === 'ctrl' && !evt.ctrlKey) ||
            (mod === 'shift' && !evt.shiftKey) ||
            (mod === 'alt' && !evt.altKey) ||
            (mod === 'none' && isModKeyPressed)) {
            return;
        }

        this.stopInertiaScroll();
        const targetElement = evt.target as HTMLElement;
        if (!targetElement.closest('.workspace-leaf-content')) return;
        
        const scrollableEl = this.getScrollableElement();
        if (!scrollableEl) return;
        
        this.isDragging = true;
        this.startY = evt.clientY;
        this.didDrag = false; 
        this.lastVelocityY = 0; 
        evt.preventDefault();
    };

    handleMouseMove = (evt: MouseEvent) => {
        if (!this.isDragging) return;
        const scrollableEl = this.getScrollableElement();
        if (!scrollableEl) return;

        if (!this.didDrag) {
            if (Math.abs(evt.clientY - this.startY) > this.DRAG_THRESHOLD) {
                this.didDrag = true;
                document.body.classList.add('is-dragging-to-scroll');
            }
        }
        
        if (this.didDrag) {
            const deltaY = evt.clientY - this.startY;
            const scrollAmount = -deltaY;
            scrollableEl.scrollBy(0, scrollAmount);
            this.lastVelocityY = scrollAmount;
            this.startY = evt.clientY;
        }
    };

    handleMouseUp = (evt: MouseEvent) => {
        if (evt.button !== this.settings.mouseButton || !this.isDragging) return;
        
        this.isDragging = false;
        
        if (this.didDrag) {
            document.body.classList.remove('is-dragging-to-scroll');
            this.startInertiaScroll();
        }
    };

    handleContextMenu = (evt: MouseEvent) => {
        // If a drag just occurred...
        if (this.didDrag) {
            // ...and it was a right-click drag, prevent the context menu.
            if (this.settings.mouseButton === 2) {
                evt.preventDefault();
                evt.stopImmediatePropagation();
            }
            // Always reset the drag flag after processing a drag action,
            // regardless of which mouse button was used.
            this.didDrag = false;
        }
    };

    startInertiaScroll = () => {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = requestAnimationFrame(this.inertiaStep);
    }

    stopInertiaScroll = () => {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.lastVelocityY = 0;
    }

    inertiaStep = () => {
        const scrollableEl = this.getScrollableElement();
        // Stop if velocity is negligible or the element is gone
        if (!scrollableEl || Math.abs(this.lastVelocityY) < 1) {
            this.stopInertiaScroll();
            return;
        }
        
        scrollableEl.scrollBy(0, this.lastVelocityY);
        this.lastVelocityY *= this.settings.friction;
        
        this.animationFrameId = requestAnimationFrame(this.inertiaStep);
    };
}


class DragToScrollSettingTab extends PluginSettingTab {
	plugin: DragToScrollPlugin;

	constructor(app: App, plugin: DragToScrollPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Mouse button')
			.setDesc('The mouse button used to initiate drag-to-scroll.')
			.addDropdown(dropdown => dropdown
				.addOption('0', 'Left Mouse Button')
				.addOption('1', 'Middle Mouse Button')
				.addOption('2', 'Right Mouse Button')
				.setValue(String(this.plugin.settings.mouseButton))
				.onChange(async (value) => {
					this.plugin.settings.mouseButton = parseInt(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Modifier key')
			.setDesc('An optional modifier key that must be held down to enable drag-to-scroll.')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None')
				.addOption('ctrl', 'Ctrl')
				.addOption('shift', 'Shift')
				.addOption('alt', 'Alt')
				.setValue(this.plugin.settings.modifierKey)
				.onChange(async (value: 'none' | 'ctrl' | 'shift' | 'alt') => {
					this.plugin.settings.modifierKey = value;
					await this.plugin.saveSettings();
				}));
        
        new Setting(containerEl)
            .setName('Inertia')
            .setDesc("Controls the glide effect after release. Left side stops instantly, right side glides for a long time.")
            .addSlider(slider => slider
                .setLimits(0.80, 0.99, 0.01) // Min, Max, and Step
                .setValue(this.plugin.settings.friction)
                .setDynamicTooltip() // Shows the current value as you slide
                .onChange(async (value) => {
                    this.plugin.settings.friction = value;
                    await this.plugin.saveSettings();
                }));
	}
}