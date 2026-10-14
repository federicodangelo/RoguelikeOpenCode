import type { Game } from "../core/game.ts";
import type { MenuEntry } from "../ui/menu.ts";
import type { Settings } from "./settings.ts";

export interface MenuTreeActions {
  cycleScaling(): void;
  toggleSound(): void;
  cycleVolume(): void;
  setVolume(value: number): void;
  toggleAutosave(): void;
  save(): void;
  load(): void;
  reset(): void;
  back(): void;
}

export function buildMenuTree(game: Game, settings: Settings, actions: MenuTreeActions): MenuEntry[] {
  const consume = (fn: () => boolean) => () => {
    if (game.playerStunned()) {
      game.logMessage("You are stunned and cannot act.");
      game.monstersAct();
      game.refreshFOV();
      if (game.gameOver) game.menuOpen = false;
      return;
    }
    if (fn()) {
      game.monstersAct();
      game.refreshFOV();
      if (game.gameOver) game.menuOpen = false;
    }
  };

  return [
    {
      label: "Help",
      hint: "Enter to open help",
      submenu: () => [{ label: "Back", hint: "Enter to return to the menu", action: actions.back }],
    },
    {
      label: "Inventory",
      hint: ["Enter to open inventory", "I: open inventory directly"],
      submenu: () => {
        const inv = game.inventory;
        return [
          {
            label: `Sword: ${inv.sword ? "equipped" : "none"}`,
            hint: [
              inv.sword ? "Equipped sword" : "No sword equipped",
              inv.sword ? "Grants +1 ATK" : "Find a sword to equip",
              `Current ATK: ${game.player.atk}`,
            ],
          },
          {
            label: `Shield: ${inv.shield ? "equipped" : "none"}`,
            hint: [
              inv.shield ? "Equipped shield" : "No shield equipped",
              inv.shield ? "Grants +1 DEF" : "Find a shield to equip",
              `Current DEF: ${game.player.def}`,
            ],
          },
          {
            label: `Potions: ${inv.potions}`,
            hint: [
              inv.potions > 0 ? "Enter: drink potion (+5 HP)" : "No potions",
              `Current HP: ${game.player.hp}/${game.player.maxHp}`,
              inv.potions > 0 ? `Potions: ${inv.potions}` : "Find potions to drink",
            ],
            action: inv.potions > 0 ? consume(() => game.drink()) : undefined,
          },
          {
            label: `Torches: ${inv.torches}`,
            hint: [
              inv.torches > 0 ? "Enter: light torch" : "No torches",
              `Light turns: ${game.lightTurns}`,
              inv.torches > 0 ? `Torches: ${inv.torches}` : "Find torches to light",
            ],
            action: inv.torches > 0 ? consume(() => game.useTorch()) : undefined,
          },
          {
            label: `Gold: ${inv.gold}`,
            hint: ["Gold collected", `Current gold: ${inv.gold}`, "No current spending"],
          },
          { label: "Back", hint: "Enter to return to the menu", action: actions.back },
        ];
      },
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
        {
          label: `Volume: ${Math.round(settings.volume * 100)}%`,
          hint: [
            "Left/Right: adjust volume",
            `Current volume: ${Math.round(settings.volume * 100)}%`,
            "M: toggle sound",
          ],
          slider: {
            value: settings.volume,
            min: 0,
            max: 1,
            step: 0.1,
            onChange: actions.setVolume,
          },
        },
        {
          label: `Autosave: ${settings.autosave ? "on" : "off"}`,
          hint: [
            "Enter: toggle autosave",
            `Current autosave: ${settings.autosave ? "on" : "off"}`,
            settings.autosave
              ? "Save/Load are disabled when autosave is on"
              : "Save/Load are available when autosave is off",
          ],
          action: actions.toggleAutosave,
        },
        { label: "Back", hint: "Enter to return to the menu", action: actions.back },
      ],
    },
    ...(settings.autosave
      ? []
      : [
          {
            label: "Save",
            hint: ["Enter to save now", "Autosave is off"],
            action: actions.save,
          },
          {
            label: "Load",
            hint: ["Enter to load the latest save", "Autosave is off"],
            action: actions.load,
          },
        ]),
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
