import type { Game } from "../core/game.ts";
import type { MenuEntry } from "../ui/menu.ts";
import type { Settings } from "./settings.ts";

export interface MenuTreeActions {
  cycleScaling(): void;
  toggleSound(): void;
  save(): void;
  load(): void;
  reset(): void;
  back(): void;
}

export function buildMenuTree(game: Game, settings: Settings, actions: MenuTreeActions): MenuEntry[] {
  return [
    {
      label: "Help",
      hint: "Enter to open help",
      submenu: () => [{ label: "Back", hint: "Enter to return to the menu", action: actions.back }],
    },
    {
      label: `Skills (${game.player.skillPoints})`,
      hint: [`Enter to open skills`, `Skill points: ${game.player.skillPoints}`],
      submenu: () => [
        {
          label: "+1 ATK",
          hint: ["Enter: spend 1 skill point", `Current ATK: ${game.player.atk}`],
          action: () => game.spendSkill("atk"),
        },
        {
          label: "+1 DEF",
          hint: ["Enter: spend 1 skill point", `Current DEF: ${game.player.def}`],
          action: () => game.spendSkill("def"),
        },
        {
          label: "+2 Max HP",
          hint: ["Enter: spend 1 skill point", `Current Max HP: ${game.player.maxHp}`],
          action: () => game.spendSkill("hp"),
        },
        { label: "Back", hint: "Enter to return to the menu", action: actions.back },
      ],
    },
    {
      label: "Settings",
      hint: "Enter to open settings",
      submenu: () => [
        {
          label: `Scaling mode: ${settings.scalingMode}`,
          hint: [
            "Enter: cycle integer / fractional / smooth",
            "Fractional snaps to 0.25 steps (1.25, 1.5, 1.75)",
            `Current scaling: ${settings.scalingMode}`,
          ],
          action: actions.cycleScaling,
        },
        {
          label: `Sound: ${settings.soundEnabled ? "on" : "off"}`,
          hint: ["Enter: toggle sound", `Current sound: ${settings.soundEnabled ? "on" : "off"}`],
          action: actions.toggleSound,
        },
        { label: "Back", hint: "Enter to return to the menu", action: actions.back },
      ],
    },
    {
      label: "Save",
      hint: ["Enter to save now", "The game auto-saves after every move"],
      action: actions.save,
    },
    {
      label: "Load",
      hint: ["Enter to load the latest auto-save", "Auto-save happens after every move"],
      action: actions.load,
    },
    {
      label: "Cheats",
      hint: "Enter to open cheats",
      submenu: () => [
        {
          label: `God mode: ${game.godMode ? "on" : "off"}`,
          hint: ["Enter: toggle invulnerability", `Current god mode: ${game.godMode ? "on" : "off"}`],
          action: () => game.toggleGodMode(),
        },
        {
          label: "Level up",
          hint: ["Enter: gain a level", `Current level: ${game.player.level}`],
          action: () => game.cheatLevelUp(),
        },
        {
          label: "Next depth",
          hint: ["Enter: descend without stairs", `Current depth: ${game.depth}`],
          action: () => game.cheatNextDepth(),
        },
        { label: "Back", hint: "Enter to return to the menu", action: actions.back },
      ],
    },
    { label: "Restart", hint: "Enter to restart the run from depth 1", action: actions.reset },
  ];
}
