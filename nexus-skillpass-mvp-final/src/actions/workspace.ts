'use server';

import type { ActionState } from '@/lib/action-state';
import { fdAll, fdBool, fdString, rateLimit, runAction } from '@/lib/server/action';
import { requireSession, write } from '@/lib/server/backend';
import { AppError } from '@/lib/server/errors';
import { removeEvidenceFile, storeEvidenceFile } from '@/lib/server/storage';
import { fileEvidenceSchema, linkEvidenceSchema, submitSchema, taskSchema, taskStatusSchema, vathSchema } from '@/lib/schemas';

export async function saveTask(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_save_task', taskSchema.parse({
      id: fdString(fd, 'id'), challenge_id: fdString(fd, 'challenge_id'), title: fdString(fd, 'title'), description: fdString(fd, 'description'),
      status: fdString(fd, 'status') || 'todo', assignee_id: fdString(fd, 'assignee_id'), deliverable_id: fdString(fd, 'deliverable_id'), due_date: fdString(fd, 'due_date'),
    }));
    return { message: 'saved' };
  });
}

export async function setTaskStatus(fd: FormData) {
  await runAction(async () => {
    await write('sp_set_task_status', taskStatusSchema.parse({ task_id: fdString(fd, 'task_id'), status: fdString(fd, 'status') }));
  });
}

export async function deleteTask(fd: FormData) {
  await runAction(async () => { await write('sp_delete_task', { task_id: fdString(fd, 'task_id') }); });
}

/** Link evidence, or a file upload validated by size, MIME allow-list and magic number before storage. */
export async function addEvidence(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const session = await requireSession();
    const base = {
      challenge_id: fdString(fd, 'challenge_id'), title: fdString(fd, 'title'), description: fdString(fd, 'description'),
      deliverable_id: fdString(fd, 'deliverable_id'), task_id: fdString(fd, 'task_id'), competency_ids: fdAll(fd, 'competency_ids'),
      is_public: fdBool(fd, 'is_public'), previous_id: fdString(fd, 'previous_id'),
    };
    if (fdString(fd, 'source') === 'file') {
      rateLimit(`upload:${session.userId}`, 20);
      const input = fileEvidenceSchema.parse(base);
      const file = fd.get('file');
      if (!(file instanceof File)) throw new AppError('evidence_source_required', 400, 'file');
      const stored = await storeEvidenceFile(session, input.challenge_id, file);
      try {
        await write('sp_add_evidence', { ...input, ...stored });
      } catch (error) {
        await removeEvidenceFile(session, stored.storage_path);
        throw error;
      }
    } else {
      await write('sp_add_evidence', linkEvidenceSchema.parse({ ...base, kind: fdString(fd, 'kind') || 'link', url: fdString(fd, 'url') }));
    }
    return { message: 'added' };
  });
}

export async function deleteEvidence(fd: FormData) {
  await runAction(async () => {
    const session = await requireSession();
    const result = await write<{ storage_path: string | null }>('sp_delete_evidence', { id: fdString(fd, 'id') });
    await removeEvidenceFile(session, result.storage_path);
  });
}

export async function setEvidenceVisibility(fd: FormData) {
  await runAction(async () => { await write('sp_set_evidence_visibility', { id: fdString(fd, 'id'), is_public: fdBool(fd, 'is_public') }); });
}

export async function saveVath(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await write('sp_save_vath', vathSchema.parse({
      id: fdString(fd, 'id'), challenge_id: fdString(fd, 'challenge_id'), activity_date: fdString(fd, 'activity_date'), activity: fdString(fd, 'activity'),
      description: fdString(fd, 'description'), hours: fdString(fd, 'hours'), task_id: fdString(fd, 'task_id'), evidence_ids: fdAll(fd, 'evidence_ids'),
    }));
    return { message: 'saved' };
  });
}

export async function deleteVath(fd: FormData) {
  await runAction(async () => { await write('sp_delete_vath', { id: fdString(fd, 'id') }); });
}

export async function submitForValidation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const result = await write<{ request_id: string }>('sp_submit_for_validation', submitSchema.parse({ challenge_id: fdString(fd, 'challenge_id'), note: fdString(fd, 'note') }));
    return { message: 'submitted', id: result.request_id };
  });
}
