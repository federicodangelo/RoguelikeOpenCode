export interface GameEvents {
  hit?: () => void;
  kill?: () => void;
  level?: () => void;
  hurt?: () => void;
  death?: () => void;
  stairs?: () => void;
  pickup?: () => void;
  potion?: () => void;
}
