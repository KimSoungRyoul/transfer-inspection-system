'use server';

/**
 * 목록에서 "이 내용으로 다시 신청" 을 누를 때 쓰는 단건 조회.
 *
 * 목록 행(rowBase)에는 현장명·원청 정도만 있어 재신청 초안을 채울 수 없다.
 * 목록 전체를 상세 DTO 로 부풀리는 대신, 누른 그 한 건만 다시 읽는다.
 */
import { getApplication } from '@/lib/data';
import { readSession } from '@/lib/session';
import type { ApplicationDTO } from '@/lib/domain';

export async function loadForReapplyAction(id: string): Promise<ApplicationDTO | null> {
  const s = await readSession();
  if (!s || s.role !== 'applicant') return null;
  const a = await getApplication(id, s.uid);
  // 식별번호만 알면 남의 현장 구성을 통째로 베낄 수 있으므로 본인 건인지 확인한다
  return a && a.mine ? a : null;
}
