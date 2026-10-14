import type { Game } from "../core/game.ts";
import { CARRIED_CAP } from "../core/constants.ts";
import { countConsumable, itemName } from "../core/items.ts";
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
      id: "help",
      label: "Help",
      hint: "Enter to open help",
      submenu: () => [{ label: "Back", hint: "Enter to return to the menu", action: actions.back }],
    },
    {
      id: "inventory",
      label: "Inventory",
      hint: ["Enter to open inventory", "I: open inventory directly"],
      submenu: () => {
        const inv = game.inventory;
        const entries: MenuEntry[] = [];

        const weapon = inv.equipment.weapon;
        entries.push({
          id: "slot-weapon",
          label: `Weapon: ${weapon ? itemName(weapon) : "none"}`,
          hint: weapon
            ? ["Enter: unequip weapon", `Grants +${weapon.stat} ATK`, `Current ATK: ${game.player.atk}`]
            : ["No weapon equipped", "Pick up a weapon to equip it", `Current ATK: ${game.player.atk}`],
          action: weapon ? consume(() => game.unequip("weapon")) : undefined,
        });

        const armor = inv.equipment.armor;
        entries.push({
          id: "slot-armor",
          label: `Armor: ${armor ? itemName(armor) : "none"}`,
          hint: armor
            ? ["Enter: unequip armor", `Grants +${armor.stat} DEF`, `Current DEF: ${game.player.def}`]
            : ["No armor equipped", "Pick up armor to equip it", `Current DEF: ${game.player.def}`],
          action: armor ? consume(() => game.unequip("armor")) : undefined,
        });

        for (const item of inv.carried) {
          entries.push({
            id: `carried-${item.uid ?? item.variant}`,
            label: `${itemName(item)} (${item.kind})`,
            hint: [
              "Enter: equip, swapping the current piece back",
              `+${item.stat} ${item.kind === "weapon" ? "ATK" : "DEF"}`,
              `Carried: ${inv.carried.length}/${CARRIED_CAP}`,
            ],
            action: consume(() => game.equipCarried(inv.carried.indexOf(item))),
          });
        }

        for (const stack of inv.consumables) {
          if (stack.kind === "potion") {
            entries.push({
              id: `stack-potion-${stack.variant}`,
              label: `Potions: ${stack.variant} x${stack.count}`,
              hint: [
                `Enter: drink (+${stack.stat} HP)`,
                `Current HP: ${game.player.hp}/${game.player.maxHp}`,
                `Potions: ${countConsumable(inv, "potion")}`,
              ],
              action: consume(() => game.drink()),
            });
          } else {
            entries.push({
              id: `stack-torch-${stack.variant}`,
              label: `Torches: ${stack.variant} x${stack.count}`,
              hint: [
                `Enter: light (+${stack.stat} turns)`,
                `Light turns: ${game.lightTurns}`,
                `Torches: ${countConsumable(inv, "torch")}`,
              ],
              action: consume(() => game.useTorch()),
            });
          }
        }

        entries.push({
          id: "gold",
          label: `Gold: ${inv.gold}`,
          hint: ["Gold collected", `Current gold: ${inv.gold}`, "No current spending"],
        });
        entries.push({ label: "Back", hint: "Enter to return to the menu", action: actions.back });
        return entries;
      },
    },
    {
      id: "skills",
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
      id: "settings",
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
            id: "save",
            label: "Save",
            hint: ["Enter to save now", "Autosave is off"],
            action: actions.save,
          },
          {
            id: "load",
            label: "Load",
            hint: ["Enter to load the latest save", "Autosave is off"],
            action: actions.load,
          },
        ]),
    {
      id: "cheats",
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
    { id: "restart", label: "Restart", hint: "Enter to restart the run from depth 1", action: actions.reset },
  ];
}
