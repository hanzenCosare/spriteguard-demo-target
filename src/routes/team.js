const express = require('express');
const crypto = require('crypto');
const store = require('../services/mockStore');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ['Owner', 'Admin', 'Developer', 'Viewer'];
const INVITE_ROLES = ['Admin', 'Developer', 'Viewer'];

router.get('/', (_req, res) => {
  const state = store.getState();
  res.json({
    ok: true,
    summary: store.getTeamSummary(),
    members: state.members,
    invitations: state.invitations
  });
});

router.post('/invitations', (req, res) => {
  const { email, role = 'Developer', message = '' } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'A valid email address is required.'
      }
    });
  }

  if (!INVITE_ROLES.includes(role)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invitation role must be Admin, Developer, or Viewer.'
      }
    });
  }

  const state = store.getState();
  const existsInMembers = state.members.some(
    (m) => m.email.toLowerCase() === normalizedEmail
  );
  const existsInInvites = state.invitations.some(
    (inv) => inv.email.toLowerCase() === normalizedEmail
  );

  if (existsInMembers || existsInInvites) {
    return res.status(409).json({
      ok: false,
      error: {
        code: 'DUPLICATE_INVITATION',
        message: 'This email address is already a member or has a pending invitation.'
      }
    });
  }

  const teamSummary = store.getTeamSummary();
  if (teamSummary.availableSeats <= 0) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'SEAT_LIMIT_REACHED',
        message: `Seat limit (${teamSummary.seatLimit}) reached for the ${teamSummary.plan} plan. Upgrade your plan or free up a seat to invite another user.`
      }
    });
  }

  const invitation = {
    id: `inv_${crypto.randomBytes(4).toString('hex')}`,
    email: normalizedEmail,
    role,
    status: 'Pending',
    message: typeof message === 'string' ? message.trim().slice(0, 240) : '',
    invitedBy: state.settings.profile.name,
    createdAt: new Date().toISOString()
  };

  state.invitations.unshift(invitation);

  store.addActivity({
    event: 'Team member invited',
    description: `Mock ${role} invitation created for ${normalizedEmail}.`,
    resource: invitation.id,
    status: 'Pending',
    metadata: { email: normalizedEmail, role }
  });

  return res.status(201).json({
    ok: true,
    invitation,
    summary: store.getTeamSummary()
  });
});

router.post('/:id/role', (req, res) => {
  const { role } = req.body || {};
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Role must be Owner, Admin, Developer, or Viewer.'
      }
    });
  }

  const state = store.getState();
  const member = state.members.find((m) => m.id === req.params.id);

  if (!member) {
    return res.status(404).json({
      ok: false,
      error: {
        code: 'MEMBER_NOT_FOUND',
        message: 'Team member was not found.'
      }
    });
  }

  const ownerCount = state.members.filter((m) => m.role === 'Owner').length;
  if (member.role === 'Owner' && role !== 'Owner' && ownerCount <= 1) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'LAST_OWNER_PROTECTED',
        message: 'The workspace must retain at least one Owner.'
      }
    });
  }

  const previousRole = member.role;
  member.role = role;

  store.addActivity({
    event: 'Member role updated',
    description: `Changed ${member.name}'s role from ${previousRole} to ${role}.`,
    resource: member.id,
    status: 'Success',
    metadata: { email: member.email, previousRole, role }
  });

  return res.json({
    ok: true,
    member,
    summary: store.getTeamSummary()
  });
});

router.delete('/:id', (req, res) => {
  const state = store.getState();
  const { id } = req.params;

  const invIndex = state.invitations.findIndex((inv) => inv.id === id);
  if (invIndex !== -1) {
    const [removed] = state.invitations.splice(invIndex, 1);
    store.addActivity({
      event: 'Invitation cancelled',
      description: `Cancelled pending invitation for ${removed.email}.`,
      resource: removed.id,
      status: 'Warning',
      metadata: { email: removed.email }
    });

    return res.json({
      ok: true,
      removedId: id,
      kind: 'invitation',
      summary: store.getTeamSummary()
    });
  }

  const memIndex = state.members.findIndex((m) => m.id === id);
  if (memIndex === -1) {
    return res.status(404).json({
      ok: false,
      error: {
        code: 'MEMBER_NOT_FOUND',
        message: 'Team member or invitation was not found.'
      }
    });
  }

  const target = state.members[memIndex];
  const ownerCount = state.members.filter((m) => m.role === 'Owner').length;
  if (target.role === 'Owner' && ownerCount <= 1) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'LAST_OWNER_PROTECTED',
        message: 'Cannot remove the sole workspace Owner.'
      }
    });
  }

  state.members.splice(memIndex, 1);

  store.addActivity({
    event: 'Team member removed',
    description: `Removed ${target.name} (${target.email}) from workspace.`,
    resource: target.id,
    status: 'Warning',
    metadata: { email: target.email }
  });

  return res.json({
    ok: true,
    removedId: id,
    kind: 'member',
    summary: store.getTeamSummary()
  });
});

module.exports = router;
