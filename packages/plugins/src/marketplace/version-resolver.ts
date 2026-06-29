/**
 * VersionResolver resolves semver ranges, checks compatibility,
 * and determines upgrade paths between versions.
 */
export class VersionResolver {
  /**
   * Parse a semver version string into its components.
   */
  parse(version: string): { major: number; minor: number; patch: number; prerelease?: string } {
    const match = version.match(
      /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/,
    );

    if (!match) {
      throw new Error(`Invalid semver version: "${version}"`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4],
    };
  }

  /**
   * Check if a version satisfies a semver range.
   * Supports: exact, ^(caret), ~(tilde), >=, >, <=, <, *
   */
  satisfies(version: string, range: string): boolean {
    if (range === '*') return true;

    const parsed = this.parse(version);

    if (range.startsWith('^')) {
      return this.satisfiesCaret(parsed, range.slice(1));
    }

    if (range.startsWith('~')) {
      return this.satisfiesTilde(parsed, range.slice(1));
    }

    if (range.startsWith('>=')) {
      return this.compare(version, range.slice(2)) >= 0;
    }

    if (range.startsWith('>')) {
      return this.compare(version, range.slice(1)) > 0;
    }

    if (range.startsWith('<=')) {
      return this.compare(version, range.slice(2)) <= 0;
    }

    if (range.startsWith('<')) {
      return this.compare(version, range.slice(1)) < 0;
    }

    // Exact match
    return version === range;
  }

  /**
   * Compare two semver versions.
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  compare(a: string, b: string): number {
    const parsedA = this.parse(a);
    const parsedB = this.parse(b);

    if (parsedA.major !== parsedB.major) return parsedA.major > parsedB.major ? 1 : -1;
    if (parsedA.minor !== parsedB.minor) return parsedA.minor > parsedB.minor ? 1 : -1;
    if (parsedA.patch !== parsedB.patch) return parsedA.patch > parsedB.patch ? 1 : -1;

    // Pre-release versions have lower precedence
    if (parsedA.prerelease && !parsedB.prerelease) return -1;
    if (!parsedA.prerelease && parsedB.prerelease) return 1;

    return 0;
  }

  /**
   * Find the latest version that satisfies a range from a list of available versions.
   */
  resolve(range: string, availableVersions: string[]): string | null {
    const matching = availableVersions
      .filter((v) => this.satisfies(v, range))
      .sort((a, b) => this.compare(b, a));

    return matching.length > 0 ? matching[0] : null;
  }

  /**
   * Determine if upgrading from one version to another is a breaking change.
   */
  isBreakingChange(from: string, to: string): boolean {
    const parsedFrom = this.parse(from);
    const parsedTo = this.parse(to);

    return parsedTo.major > parsedFrom.major;
  }

  /**
   * Get the upgrade path between two versions.
   */
  getUpgradePath(
    from: string,
    to: string,
    availableVersions: string[],
  ): string[] {
    const sorted = [...availableVersions].sort((a, b) => this.compare(a, b));

    const fromIndex = sorted.indexOf(from);
    const toIndex = sorted.indexOf(to);

    if (fromIndex === -1 || toIndex === -1) {
      throw new Error(`Version not found in available versions`);
    }

    if (fromIndex >= toIndex) {
      return [from];
    }

    // For breaking changes, return all major version boundaries
    const path: string[] = [from];
    let currentMajor = this.parse(from).major;

    for (let i = fromIndex + 1; i <= toIndex; i++) {
      const parsed = this.parse(sorted[i]);
      if (parsed.major > currentMajor) {
        path.push(sorted[i]);
        currentMajor = parsed.major;
      }
    }

    if (path[path.length - 1] !== to) {
      path.push(to);
    }

    return path;
  }

  /**
   * Check if a version is compatible with a minimum required version.
   */
  isCompatible(version: string, minVersion: string): boolean {
    return this.compare(version, minVersion) >= 0;
  }

  private satisfiesCaret(
    parsed: { major: number; minor: number; patch: number },
    rangeVersion: string,
  ): boolean {
    const rangeParsed = this.parse(rangeVersion);

    // ^major.minor.patch: allows changes that do not modify the left-most non-zero digit
    if (rangeParsed.major !== 0) {
      // ^1.2.3 := >=1.2.3 <2.0.0
      return parsed.major === rangeParsed.major &&
        (parsed.minor > rangeParsed.minor ||
          (parsed.minor === rangeParsed.minor && parsed.patch >= rangeParsed.patch));
    }

    if (rangeParsed.minor !== 0) {
      // ^0.2.3 := >=0.2.3 <0.3.0
      return parsed.major === 0 &&
        parsed.minor === rangeParsed.minor &&
        parsed.patch >= rangeParsed.patch;
    }

    // ^0.0.3 := >=0.0.3 <0.0.4
    return parsed.major === 0 && parsed.minor === 0 && parsed.patch === rangeParsed.patch;
  }

  private satisfiesTilde(
    parsed: { major: number; minor: number; patch: number },
    rangeVersion: string,
  ): boolean {
    const rangeParsed = this.parse(rangeVersion);

    // ~1.2.3 := >=1.2.3 <1.3.0
    return parsed.major === rangeParsed.major &&
      parsed.minor === rangeParsed.minor &&
      parsed.patch >= rangeParsed.patch;
  }
}
