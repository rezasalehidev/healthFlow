import { AppointmentsRealtimeGateway } from './appointments.gateway';

describe('AppointmentsRealtimeGateway broadcast', () => {
  it('emits to appointment and user rooms', () => {
    const roomEmit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit: roomEmit });
    const namespaceEmit = jest.fn();
    const gateway = Object.create(
      AppointmentsRealtimeGateway.prototype,
    ) as AppointmentsRealtimeGateway;
    gateway.server = { to, emit: namespaceEmit } as never;
    (gateway as unknown as { logger: { log: jest.Mock } }).logger = { log: jest.fn() };

    gateway.broadcastAppointmentUpdate({
      type: 'appointment.confirmed',
      appointmentId: 'appt-1',
      patientId: 'patient-1',
      doctorId: 'doctor-user-1',
      occurredAt: '2026-08-07T00:00:00.000Z',
    });

    expect(to).toHaveBeenCalledWith('appointment:appt-1');
    expect(to).toHaveBeenCalledWith('user:patient-1');
    expect(to).toHaveBeenCalledWith('user:doctor-user-1');
    expect(roomEmit).toHaveBeenCalledWith(
      'appointment.updated',
      expect.objectContaining({
        event: 'appointment.updated',
        data: expect.objectContaining({
          type: 'appointment.confirmed',
        }) as Record<string, unknown>,
      }) as Record<string, unknown>,
    );
    expect(namespaceEmit).toHaveBeenCalledWith(
      'appointment.updated',
      expect.objectContaining({ event: 'appointment.updated' }) as Record<string, unknown>,
    );
  });
});
