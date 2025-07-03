import { Plugin, MarkdownView } from 'obsidian';

export default class DragToScrollPlugin extends Plugin {
    isDragging: boolean = false;
    startY: number = 0;
    didDrag: boolean = false;

    // A small movement threshold to distinguish a click from a drag
    private readonly DRAG_THRESHOLD = 5;

    async onload() {
        console.log('Loading Drag to Scroll plugin');

        this.registerDomEvent(document, 'mousedown', this.handleMouseDown);
        this.registerDomEvent(document, 'mousemove', this.handleMouseMove);
        this.registerDomEvent(document, 'mouseup', this.handleMouseUp);
        
        // Use the 'capture' phase to reliably prevent the context menu
        this.registerDomEvent(document, 'contextmenu', this.handleContextMenu, { capture: true });
    }

    onunload() {
        console.log('Unloading Drag to Scroll plugin');
        // Reset cursor just in case the plugin is disabled mid-drag
        document.body.style.cursor = 'default';
    }

    /**
     * Finds the correct scrollable element by first checking the view's mode 
     * ('source' vs 'preview') and then running the specific query for that mode.
     * This prevents conflicts in Live Preview where both selectors might exist.
     */
    getScrollableElement = (): HTMLElement | null => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return null;

        const mode = view.getMode();
        const container = view.containerEl;

        if (mode === 'source') { // Handles Live Preview and Source Mode
            return container.querySelector<HTMLElement>('.cm-scroller');
        }
        
        if (mode === 'preview') { // Handles Reading Mode
            return container.querySelector<HTMLElement>('.markdown-preview-view');
        }

        return null; // Fallback
    }
    
    handleMouseDown = (evt: MouseEvent) => {
        if (evt.button !== 2) return;

        const targetElement = evt.target as HTMLElement;
        if (!targetElement.closest('.workspace-leaf-content')) return;
        
        const scrollableEl = this.getScrollableElement();
        if (!scrollableEl) return;
        
        this.isDragging = true;
        this.startY = evt.clientY;
        this.didDrag = false; 
        
        evt.preventDefault();
    };

    handleMouseMove = (evt: MouseEvent) => {
        if (!this.isDragging) return;

        const scrollableEl = this.getScrollableElement();
        if (!scrollableEl) return;

        if (!this.didDrag) {
            if (Math.abs(evt.clientY - this.startY) > this.DRAG_THRESHOLD) {
                this.didDrag = true;
                document.body.style.cursor = 'grabbing';
            }
        }
        
        if (this.didDrag) {
            const deltaY = evt.clientY - this.startY;
            // Touch-like scroll direction
            scrollableEl.scrollBy(0, -deltaY);
            this.startY = evt.clientY;
        }
    };

    handleMouseUp = (evt: MouseEvent) => {
        if (evt.button !== 2 || !this.isDragging) return;
        
        this.isDragging = false;
        
        if (this.didDrag) {
            document.body.style.cursor = 'default';
        }
    };

    handleContextMenu = (evt: MouseEvent) => {
        if (this.didDrag) {
            evt.preventDefault();
            evt.stopImmediatePropagation();
            this.didDrag = false;
        }
    };
}