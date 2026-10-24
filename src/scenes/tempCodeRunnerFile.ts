if (texture === null) {
  throw new Error(`Failed to create texture: ${key}`);
}
    const ctx = texture.getContext();