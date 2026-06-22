import { Bounty } from '../domain/bounty';

export interface BountySource {
  readonly name: string;
  fetch(): Promise<Bounty[]>;
}

export const BOUNTY_SOURCES = Symbol('BOUNTY_SOURCES');
