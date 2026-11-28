import { api } from '../api/client.js';
import { ICONS } from '../data/demo-data.js';
import { getState, updateSearchIndex } from '../core/state.js';
import { navigate } from '../core/router.js';
import {
  escapeHtml,
  formatDate,
  statusBadgeClass
} from '../core/formatters.js';
import { renderDataTable } from '../components/data-table.js';
import { renderErrorState, renderPageSkeleton } from '../components/loading.js';
import { confirmModal, openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function openInviteMemberModal(summary, onInvited) {
  openModal({
    title: 'Invite Team Member',
    subtitle: `${summary.availableSeats} seat${summary.availableSeats === 1 ? '' : 's'} remaining on your ${summary.plan} plan.`,
    size: 'md',
    bodyHtml: `
      <form id="invite-member-form" class="stack-md" novalidate>
        <div class="form-group">
          <label class="form-label" for="invite-email">Email address<span class="form-required">*</span></label>
          <input type="email" id="invite-email" class="form-input" placeholder="teammate@acme-ai.example" required />
          <div class="form-error" id="invite-email-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label" for="invite-role">Role</label>
          <select id="invite-role" class="form-select">
            <option value="Developer">Developer</option>
            <option value="Admin">Admin</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="invite-message">Personal message (optional)</label>
          <textarea id="invite-message" class="form-textarea" placeholder="Add context for your teammate..."></textarea>
        </div>
        <div class="notice-box notice-box-info">
          Demo mode: invitations are stored in memory only; no real emails are sent.
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="submit" form="invite-member-form" class="btn btn-primary" id="invite-submit-btn">
        Send Invitation
      </button>
    `,
    onMount: (root, close) => {
      const form = root.querySelector('#invite-member-form');
      const emailInput = root.querySelector('#invite-email');
      const emailError = root.querySelector('#invite-email-error');
      const submitBtn = root.querySelector('#invite-submit-btn');

      emailInput.addEventListener('input', () => {
        emailInput.classList.remove('invalid');
        emailError.textContent = '';
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = emailInput.value.trim();
        if (!email || !EMAIL_RE.test(email)) {
          emailInput.classList.add('invalid');
          emailError.textContent = 'Please enter a valid email address.';
          emailInput.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Inviting...`;

        try {
          await api.inviteMember({
            email,
            role: root.querySelector('#invite-role').value,
            message: root.querySelector('#invite-message').value.trim()
          });
          close();
          showToast({
            type: 'success',
            title: 'Invitation created',
            description: `Pending invitation added for ${email}.`
          });
          await onInvited();
        } catch (err) {
          emailInput.classList.add('invalid');
          emailError.textContent = err.message;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Invitation';
        }
      });
    }
  });
}

function openMemberDetailsModal(member, dateFmt) {
  openModal({
    title: member.name,
    subtitle: member.title || 'Workspace Member',
    size: 'sm',
    bodyHtml: `
      <dl class="detail-list">
        <dt>Email</dt>
        <dd>${escapeHtml(member.email)}</dd>
        <dt>Role</dt>
        <dd><span class="badge badge-primary">${escapeHtml(member.role)}</span></dd>
        <dt>Status</dt>
        <dd><span class="badge ${statusBadgeClass(member.status)}"><span class="badge-dot"></span>${escapeHtml(member.status)}</span></dd>
        <dt>Joined</dt>
        <dd>${escapeHtml(formatDate(member.joinedAt, dateFmt))}</dd>
      </dl>
    `,
    footerHtml: `<button type="button" class="btn btn-primary" data-modal-close>Close</button>`
  });
}

export async function renderTeamView(container) {
  container.innerHTML = renderPageSkeleton();

  try {
    const data = await api.getTeam();
    const { summary, members, invitations } = data;
    const dateFmt = getState().workspace.dateFormat;

    updateSearchIndex({ members });

    const seatUsagePct = Math.min(100, Math.round((summary.usedSeats / Math.max(1, summary.seatLimit)) * 100));

    container.innerHTML = `
      <section class="stack-lg">
        <div class="page-header">
          <div>
            <h1 class="page-title">Team</h1>
            <p class="page-subtitle">Manage the people who have access to your workspace.</p>
          </div>
          <div class="page-header-actions">
            ${
              summary.availableSeats <= 0
                ? `<button type="button" class="btn btn-secondary" id="team-upgrade-seats-btn">Upgrade for more seats</button>`
                : ''
            }
            <button
              type="button"
              class="btn btn-primary"
              id="invite-member-btn"
              ${summary.availableSeats <= 0 ? 'disabled title="Seat limit reached for current plan"' : ''}
            >
              ${ICONS.plus}
              <span>Invite Member</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-4">
          <div class="stat-card">
            <span class="stat-card-label">Total Members</span>
            <div class="stat-card-value">${escapeHtml(summary.totalMembers)}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Available Seats</span>
            <div class="stat-card-value" style="color: ${summary.availableSeats > 0 ? 'var(--color-success)' : 'var(--color-warning)'};">${escapeHtml(summary.availableSeats)}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Pending Invitations</span>
            <div class="stat-card-value">${escapeHtml(summary.pendingInvitations)}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">${escapeHtml(summary.plan)} Seat Limit</span>
            <div class="stat-card-value">${escapeHtml(summary.usedSeats)} / ${escapeHtml(summary.seatLimit)}</div>
            <div class="progress-bar" style="margin-top: 2px;">
              <div class="progress-fill" style="width: ${seatUsagePct}%;"></div>
            </div>
          </div>
        </div>

        <div class="surface-card">
          <div class="surface-card-header">
            <div>
              <h2 class="card-title">Workspace Members</h2>
              <p class="card-subtitle">Active users with access to analytics, keys, and billing.</p>
            </div>
          </div>
          <div id="team-members-table"></div>
        </div>

        <div class="surface-card">
          <div class="surface-card-header">
            <div>
              <h2 class="card-title">Pending Invitations</h2>
              <p class="card-subtitle">Unclaimed mock invitations occupying a workspace seat.</p>
            </div>
          </div>
          <div id="team-invitations-table"></div>
        </div>
      </section>
    `;

    const membersTableEl = container.querySelector('#team-members-table');
    renderDataTable(membersTableEl, {
      rows: members,
      emptyTitle: 'No team members',
      emptyDescription: 'Invite collaborators to share workspace insights.',
      columns: [
        {
          key: 'name',
          label: 'Member',
          render: (row) => `
            <div class="member-cell">
              <span class="avatar">${escapeHtml(row.initials)}</span>
              <div>
                <div class="member-name">${escapeHtml(row.name)}</div>
                <div class="member-sub">${escapeHtml(row.title || 'Member')}</div>
              </div>
            </div>
          `
        },
        {
          key: 'email',
          label: 'Email',
          render: (row) => `<span class="text-secondary">${escapeHtml(row.email)}</span>`
        },
        {
          key: 'role',
          label: 'Role',
          render: (row) => `
            <select
              class="table-filter-select"
              data-member-role-select="${escapeHtml(row.id)}"
              aria-label="Change role for ${escapeHtml(row.name)}"
            >
              ${['Owner', 'Admin', 'Developer', 'Viewer']
                .map(
                  (role) =>
                    `<option value="${role}" ${row.role === role ? 'selected' : ''}>${role}</option>`
                )
                .join('')}
            </select>
          `
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) =>
            `<span class="badge ${statusBadgeClass(row.status)}"><span class="badge-dot"></span>${escapeHtml(row.status)}</span>`
        },
        {
          key: 'joinedAt',
          label: 'Joined',
          render: (row) => `<span class="tabular-nums text-secondary">${escapeHtml(formatDate(row.joinedAt, dateFmt))}</span>`
        },
        {
          key: 'actions',
          label: 'Actions',
          align: 'right',
          render: (row) => `
            <div class="table-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-member-detail="${escapeHtml(row.id)}">Details</button>
              <button
                type="button"
                class="btn btn-danger-outline btn-sm"
                data-remove-member="${escapeHtml(row.id)}"
                ${row.role === 'Owner' ? 'disabled title="Cannot remove workspace owner"' : ''}
              >Remove</button>
            </div>
          `
        }
      ]
    });

    const invitesTableEl = container.querySelector('#team-invitations-table');
    renderDataTable(invitesTableEl, {
      rows: invitations,
      emptyTitle: 'No pending invitations',
      emptyDescription: 'Click "Invite Member" to add a collaborator to this workspace.',
      columns: [
        {
          key: 'email',
          label: 'Email',
          render: (row) => `<span style="font-weight: 500;">${escapeHtml(row.email)}</span>`
        },
        {
          key: 'role',
          label: 'Role',
          render: (row) => `<span class="badge badge-neutral">${escapeHtml(row.role)}</span>`
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) =>
            `<span class="badge ${statusBadgeClass(row.status)}"><span class="badge-dot"></span>${escapeHtml(row.status)}</span>`
        },
        {
          key: 'createdAt',
          label: 'Invited',
          render: (row) => `<span class="tabular-nums text-secondary">${escapeHtml(formatDate(row.createdAt, dateFmt))}</span>`
        },
        {
          key: 'actions',
          label: 'Actions',
          align: 'right',
          render: (row) => `
            <button type="button" class="btn btn-danger-outline btn-sm" data-cancel-invite="${escapeHtml(row.id)}">
              Cancel Invite
            </button>
          `
        }
      ]
    });

    // Event bindings
    container.querySelector('#invite-member-btn').addEventListener('click', () => {
      openInviteMemberModal(summary, () => renderTeamView(container));
    });

    const upgradeBtn = container.querySelector('#team-upgrade-seats-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => navigate('billing'));
    }

    membersTableEl.querySelectorAll('[data-member-role-select]').forEach((select) => {
      select.addEventListener('change', async () => {
        const memberId = select.dataset.memberRoleSelect;
        const nextRole = select.value;
        try {
          await api.updateMemberRole(memberId, nextRole);
          showToast({
            type: 'success',
            title: 'Member role updated',
            description: `Updated role to ${nextRole}.`
          });
          await renderTeamView(container);
        } catch (err) {
          showToast({
            type: 'error',
            title: 'Role update failed',
            description: err.message
          });
          await renderTeamView(container);
        }
      });
    });

    membersTableEl.querySelectorAll('[data-member-detail]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = members.find((m) => m.id === btn.dataset.memberDetail);
        if (found) openMemberDetailsModal(found, dateFmt);
      });
    });

    membersTableEl.querySelectorAll('[data-remove-member]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = members.find((m) => m.id === btn.dataset.removeMember);
        if (!found) return;
        confirmModal({
          title: 'Remove Team Member',
          message: `Remove ${found.name} (${found.email}) from your workspace? This frees up one seat immediately.`,
          confirmLabel: 'Remove Member',
          danger: true,
          onConfirm: async () => {
            await api.removeMemberOrInvite(found.id);
            showToast({
              type: 'warning',
              title: 'Member removed',
              description: `${found.name} no longer has access.`
            });
            await renderTeamView(container);
          }
        });
      });
    });

    invitesTableEl.querySelectorAll('[data-cancel-invite]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = invitations.find((i) => i.id === btn.dataset.cancelInvite);
        if (!found) return;
        confirmModal({
          title: 'Cancel Invitation',
          message: `Cancel the pending invitation for ${found.email}?`,
          confirmLabel: 'Cancel Invitation',
          danger: true,
          onConfirm: async () => {
            await api.removeMemberOrInvite(found.id);
            showToast({
              type: 'info',
              title: 'Invitation cancelled',
              description: `Revoked pending invitation for ${found.email}.`
            });
            await renderTeamView(container);
          }
        });
      });
    });
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Failed to load team directory',
      message: err.message
    });
    const retry = container.querySelector('#view-retry-btn');
    if (retry) retry.addEventListener('click', () => renderTeamView(container));
  }
}
