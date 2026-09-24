export interface Clock {

  now(): number;
  
  
  getSystemDate(): Date;
}


export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  getSystemDate(): Date {
    return new Date();
  }
}


export class TestClock implements Clock {
  private readonly fixedTime: number;

  constructor(fixedTimeIsoOrMs: string | number) {
    this.fixedTime = typeof fixedTimeIsoOrMs === 'string'
      ? new Date(fixedTimeIsoOrMs).getTime()
      : fixedTimeIsoOrMs;
  }

  now(): number {
    return this.fixedTime;
  }

  getSystemDate(): Date {
    return new Date(this.fixedTime);
  }
}

// Global default clock instance
export const defaultClock: Clock = new SystemClock();