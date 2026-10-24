import type { Game } from "../core/game.ts";
import { CARRIED_CAP } from "../core/constants.ts";
import { countConsumable, itemName, qualityColor } from "../core/items.ts";
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

  const consumeBack = (fn: () => boolean) => () => {
    consume(fn)();
    actions.back();
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
          color: weapon ? qualityColor(weapon.quality) : undefined,
          hint: weapon
            ? ["Enter: unequip weapon", `Grants +${weapon.stat} ATK`, `Current ATK: ${game.player.atk}`]
            : ["No weapon equipped", "Pick up a weapon to equip it", `Current ATK: ${game.player.atk}`],
          action: weapon ? consume(() => game.unequip("weapon")) : undefined,
        });

        const armor = inv.equipment.armor;
        entries.push({
          id: "slot-armor",
          label: `Armor: ${armor ? itemName(armor) : "none"}`,
          color: armor ? qualityColor(armor.quality) : undefined,
          hint: armor
            ? ["Enter: unequip armor", `Grants +${armor.stat} DEF`, `Current DEF: ${game.player.def}`]
            : ["No armor equipped", "Pick up armor to equip it", `Current DEF: ${game.player.def}`],
          action: armor ? consume(() => game.unequip("armor")) : undefined,
        });

        for (const item of inv.carried) {
          const statLabel = item.kind === "weapon" ? "ATK" : "DEF";
          const equipped = item.kind === "weapon" ? weapon : armor;
          let relText: string;
          if (equipped) {
            const diff = item.stat - equipped.stat;
            relText =
              diff === 0
                ? `same ${statLabel} as ${itemName(equipped)}`
                : `${diff > 0 ? "+" : ""}${diff} ${statLabel} vs ${itemName(equipped)}`;
          } else {
            relText = `nothing equipped: +${item.stat} ${statLabel}`;
          }
          const uid = item.uid ?? item.variant;
          entries.push({
            id: `carried-${uid}`,
            label: `${itemName(item)} (${item.kind})`,
            color: qualityColor(item.quality),
            hint: [relText, `Carried: ${inv.carried.length}/${CARRIED_CAP}`, "Enter: equip or drop"],
            submenu: () => {
              const idx = inv.carried.indexOf(item);
              const kids: MenuEntry[] = [];
              if (idx >= 0) {
                kids.push({
                  id: `carried-${uid}-equip`,
                  label: "Equip (swap)",
                  color: qualityColor(item.quality),
                  hint: [
                    relText,
                    equipped ? `Equipped: +${equipped.stat} ${statLabel}` : "Nothing equipped",
                    `This item: +${item.stat} ${statLabel}`,
                  ],
                  action: consumeBack(() => game.equipCarried(idx)),
                });
                kids.push({
                  id: `carried-${uid}-drop`,
                  label: "Drop on floor",
                  hint: "Enter: leave this item on the ground",
                  action: consumeBack(() => game.dropCarried(idx)),
                });
              }
              kids.push({ label: "Back", hint: "Enter to return to the menu", action: actions.back });
              return kids;
            },
          });
        }

        for (const stack of inv.consumables) {
          const isPotion = stack.kind === "potion";
          const group = isPotion ? "Potions" : "Torches";
          const verb = isPotion ? "Drink" : "Light";
          const benefit = isPotion ? `+${stack.stat} HP` : `+${stack.stat} light turns`;
          entries.push({
            id: `stack-${stack.kind}-${stack.variant}`,
            label: `${group}: ${stack.variant} x${stack.count}`,
            color: qualityColor(stack.quality),
            hint: [
              `Enter: ${verb.toLowerCase()} or drop one`,
              benefit,
              `${group}: ${countConsumable(inv, stack.kind)}`,
            ],
            submenu: () => {
              const kids: MenuEntry[] = [];
              if (inv.consumables.includes(stack)) {
                kids.push({
                  id: `stack-${stack.kind}-${stack.variant}-use`,
                  label: verb,
                  hint: isPotion
                    ? [benefit, `Current HP: ${game.player.hp}/${game.player.maxHp}`]
                    : [benefit, `Light turns: ${game.lightTurns}`],
                  action: consumeBack(() => (isPotion ? game.drink(stack) : game.useTorch(stack))),
                });
                kids.push({
                  id: `stack-${stack.kind}-${stack.variant}-drop`,
                  label: "Drop one",
                  hint: "Enter: leave one on the ground",
                  action: consumeBack(() => game.dropConsumable(stack)),
                });
              }
              kids.push({ label: "Back", hint: "Enter to return to the menu", action: actions.back });
              return kids;
            },
          });
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
