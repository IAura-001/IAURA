export function getLevelFromExperience(experience: number) {
  return Math.floor(experience / 100) + 1;
}

export function getExperienceProgress(experience: number) {
  return experience % 100;
}