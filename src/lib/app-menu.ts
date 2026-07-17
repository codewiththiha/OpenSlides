/**
 * Native application menu (macOS menu bar / Windows/Linux window menu).
 * Emits window events so React can react without tight coupling.
 */
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { emit } from "@tauri-apps/api/event";
import { isMacOS } from "./platform";

export type AppMenuEvent =
  | "menu://new-project"
  | "menu://open-dashboard"
  | "menu://export"
  | "menu://present"
  | "menu://zen"
  | "menu://settings"
  | "menu://command-palette"
  | "menu://add-slide"
  | "menu://toggle-theme";

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
      await item("menu://new-project", "New Project", "CmdOrCtrl+N"),
      await item("menu://open-dashboard", "Go to Dashboard", "CmdOrCtrl+Shift+D"),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await item("menu://export", "Export Project as JSON…", "CmdOrCtrl+E"),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "CloseWindow", text: "Close" }),
    ];

    // On macOS, Quit lives under the app menu via defaults; keep Exit on others.
    if (!isMacOS()) {
      fileItems.push(await PredefinedMenuItem.new({ item: "Separator" }));
      fileItems.push(await PredefinedMenuItem.new({ item: "Quit", text: "Quit OpenSlides" }));
    }

    const editItems = [
      await PredefinedMenuItem.new({ item: "Undo" }),
      await PredefinedMenuItem.new({ item: "Redo" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await PredefinedMenuItem.new({ item: "SelectAll" }),
    ];

    const viewItems = [
      await item("menu://present", "Start Presentation", "CmdOrCtrl+Shift+P"),
      await item("menu://zen", "Toggle Zen Mode", "CmdOrCtrl+B"),
      await item("menu://command-palette", "Command Palette", "CmdOrCtrl+K"),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await item("menu://toggle-theme", "Toggle Light/Dark UI"),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Fullscreen" }),
    ];

    const slideItems = [
      await item("menu://add-slide", "Add Slide", "CmdOrCtrl+Shift+N"),
      await item("menu://settings", "Project Settings…", "CmdOrCtrl+,"),
    ];

    const helpItems = [
      await MenuItem.new({
        id: "menu://about",
        text: "About OpenSlides",
        action: () => {
          void emit("menu://about");
        },
      }),
    ];

    const submenus = [
      await Submenu.new({ text: "File", items: fileItems }),
      await Submenu.new({ text: "Edit", items: editItems }),
      await Submenu.new({ text: "View", items: viewItems }),
      await Submenu.new({ text: "Slide", items: slideItems }),
      await Submenu.new({ text: "Help", items: helpItems }),
    ];

    // macOS app menu with About / Services / Hide / Quit
    if (isMacOS()) {
      const appMenu = await Submenu.new({
        text: "OpenSlides",
        items: [
          await MenuItem.new({
            id: "menu://about",
            text: "About OpenSlides",
            action: () => {
              void emit("menu://about");
            },
          }),
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
    // Browser-only / non-tauri preview — ignore
    console.warn("[OpenSlides] native menu unavailable:", err);
  }
}
