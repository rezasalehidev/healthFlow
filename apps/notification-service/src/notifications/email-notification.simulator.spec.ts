import { EmailNotificationSimulator } from './email-notification.simulator';

describe('EmailNotificationSimulator', () => {
  it('simulates an appointment confirmation email', async () => {
    const sim = new EmailNotificationSimulator();
    const result = await sim.sendForEvent({
      eventId: 'e1',
      type: 'appointment.confirmed',
      occurredAt: new Date().toISOString(),
      producer: 'appointment-service',
      payload: { appointmentId: 'appt-1' },
    });

    expect(result.channel).toBe('email');
    expect(result.subject).toContain('confirmed');
    expect(sim.sent).toHaveLength(1);
  });
});
