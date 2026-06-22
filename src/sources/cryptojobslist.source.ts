import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BountySource } from './bounty-source.interface';
import { Bounty } from '../domain/bounty';

@Injectable()
export class CryptoJobsListSource implements BountySource {
  readonly name = 'cryptojobslist';
  private readonly logger = new Logger(CryptoJobsListSource.name);
  private readonly BASE = 'https://cryptojobslist.com';

  constructor(private readonly http: HttpService) {}

  async fetch(): Promise<Bounty[]> {
    try {
      const page1 = await this.fetchPage(1);
      if (!page1) return [];

      const { totalPages } = page1.meta;
      const all = [...page1.jobs];
      this.logger.log(`Page 1: ${page1.jobs.length} jobs (${page1.meta.totalCount} total, ${totalPages} pages)`);

      for (let p = 2; p <= Math.min(totalPages, 20); p++) {
        const page = await this.fetchPage(p);
        if (!page) break;
        all.push(...page.jobs);
        this.logger.log(`Page ${p}: ${page.jobs.length} jobs`);
      }

      return all.map((job: any): Bounty => {
        const rewardText = this.formatSalary(job.salary, job.salaryString);
        return {
          source: this.name,
          title: job.jobTitle ?? 'Untitled Job',
          url: job.seoSlug ? `${this.BASE}/jobs/${job.seoSlug}` : this.BASE,
          reward: rewardText,
          deadline: job.publishedAt ? new Date(job.publishedAt).toISOString() : undefined,
          tags: [...(Array.isArray(job.tags) ? job.tags : []), 'job'],
          host: job.companyName,
        };
      });
    } catch (err) {
      this.logger.error(`Failed to fetch CryptoJobsList: ${(err as Error).message}`);
      return [];
    }
  }

  private async fetchPage(page: number): Promise<{ jobs: any[]; meta: any } | null> {
    const url = page === 1 ? this.BASE : `${this.BASE}/?page=${page}`;
    const { data } = await firstValueFrom(
      this.http.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15_000,
      }),
    );

    const match = String(data).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) {
      this.logger.warn(`No __NEXT_DATA__ found on page ${page}`);
      return null;
    }

    const parsed = JSON.parse(match[1]);
    const pageProps = parsed.props?.pageProps;
    if (!pageProps) return null;

    return { jobs: pageProps.jobs ?? [], meta: pageProps.meta ?? {} };
  }

  private formatSalary(salary: any, salaryString?: string): string {
    if (salaryString) return salaryString;
    if (salary?.minValue != null && salary?.maxValue != null) {
      const cur = salary.currency ?? 'USD';
      const unit = salary.unitText ?? 'YEAR';
      const min = salary.minValue >= 1000 ? `$${Math.round(salary.minValue / 1000)}k` : `$${salary.minValue}`;
      const max = salary.maxValue >= 1000 ? `$${Math.round(salary.maxValue / 1000)}k` : `$${salary.maxValue}`;
      return `${min}-${max}/${unit.toLowerCase()}`;
    }
    return '';
  }
}
