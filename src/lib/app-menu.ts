/**
 * Native application menu (macOS menu bar / Windows/Linux window menu).
 * Emits window events so React can react without tight coupling.
 */
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { emit } from "@tauri-apps/api/event";
import { isMacOS } from "./platform";
import { SHORTCUTS, shortcutAccelerator } from "./shortcuts";

export type AppMenuEvent =
  | "menu://new-project"
  | "menu://open-dashboard"
  | "menu://export"
  | "menu://present"
  | "menu://zen"
  | "menu://settings"
  | "menu://command-palette"
  | "menu://add-slide"
  | "menu://duplicate-slide"
  | "menu://toggle-theme"
  | "menu://shortcuts"
  | "menu://undo"
  | "menu://redo";

async function item(
  id: AppMenuEvent,
  text: string,
  accelerator?: string,
): Promise<MenuItem> {
  return MenuItem.new({
    id,
    text,
    accelerator,
    action: () => {
      void emit(id);
    },
  });
}

export async function installAppMenu(): Promise<void> {
  try {
    const fileItems = [
      await item("menu://new-project", "New Presentation", shortcutAccelerator(SHORTCUTS.newProject)),
      await item("menu://open-dashboard", "Go to Dashboard", shortcutAccelerator(SHORTCUTS.openDashboard)),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await item("menu://export", "Export…", shortcutAccelerator(SHORTCUTS.export)),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "CloseWindow", text: "Close" }),
    ];

    if (!isMacOS()) {
      fileItems.push(await PredefinedMenuItem.new({ item: "Separator" }));
      fileItems.push(
        await PredefinedMenuItem.new({ item: "Quit", text: "Quit OpenSlides" }),
      );
    }

    // Custom Undo/Redo so our controlled code editor history works
    // (native Predefined Undo/Redo only affect OS text fields).
    const editItems = [
      await item("menu://undo", "Undo", shortcutAccelerator(SHORTCUTS.undo)),
      await item("menu://redo", "Redo", shortcutAccelerator(SHORTCUTS.redo)),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await PredefinedMenuItem.new({ item: "SelectAll" }),
    ];

    const viewItems = [
      await item("menu://present", "Start Presentation", shortcutAccelerator(SHORTCUTS.present)),
      await item("menu://zen", "Toggle Focus Mode", shortcutAccelerator(SHORTCUTS.zen)),
      await item("menu://command-palette", "Command Palette", shortcutAccelerator(SHORTCUTS.commandPalette)),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await item("menu://toggle-theme", "Toggle Light/Dark Mode"),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Fullscreen" }),
    ];

    const slideItems = [
      await item("menu://add-slide", "Add Slide", shortcutAccelerator(SHORTCUTS.addSlide)),
      await item("menu://duplicate-slide", "Duplicate Slide", shortcutAccelerator(SHORTCUTS.duplicateSlide)),
      await item("menu://settings", "Presentation Settings…", shortcutAccelerator(SHORTCUTS.settings)),
    ];

    // Help: only Keyboard Shortcuts (no About — same modal was confusing)
    const helpItems = [
      await item("menu://shortcuts", "Keyboard Shortcuts"),
    ];

    const submenus = [
      await Submenu.new({ text: "File", items: fileItems }),
      await Submenu.new({ text: "Edit", items: editItems }),
      await Submenu.new({ text: "View", items: viewItems }),
      await Submenu.new({ text: "Slide", items: slideItems }),
      await Submenu.new({ text: "Help", items: helpItems }),
    ];

    if (isMacOS()) {
      const appMenu = await Submenu.new({
        text: "OpenSlides",
        items: [
          await item("menu://shortcuts", "Keyboard Shortcuts"),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Services" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Hide", text: "Hide OpenSlides" }),
          await PredefinedMenuItem.new({ item: "HideOthers" }),
          await PredefinedMenuItem.new({ item: "ShowAll" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Quit", text: "Quit OpenSlides" }),
        ],
      });
      submenus.unshift(appMenu);
    }

    const menu = await Menu.new({ items: submenus });
    await menu.setAsAppMenu();
  } catch (err) {
    console.warn("[OpenSlides] native menu unavailable:", err);
  }
}
