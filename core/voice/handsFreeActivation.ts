export interface HandsFreeActivationActions {
  setLive(active: boolean): void;
  setVoiceMode(active: boolean): void;
  unlockAudio(): void | Promise<void>;
  startContinuousListening(): void | Promise<void>;
}

export function activateHandsFreeVoice(actions: HandsFreeActivationActions): void {
  actions.setLive(true);
  actions.setVoiceMode(true);
  void actions.unlockAudio();
  void actions.startContinuousListening();
}
