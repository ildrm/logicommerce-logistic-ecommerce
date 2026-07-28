'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { AppHeader } from '../components/app-header';
import { accessToken, authenticatedRequest } from '../components/authenticated-api';

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

type RequestRow = {
  id: string;
  number: string;
  status: string;
  preferredModes: string[];
  stops: Array<{ id: string; sequence: number; city: string; countryCode: string }>;
  cargoItems: Array<{ weightGrams: number; description: string }>;
  estimates: Array<{ status: string; currency: string; totalMinor: number }>;
  quotes: Array<{
    id: string;
    number: string;
    status: string;
    totalMinor: number;
    currency: string;
  }>;
};
type Carrier = { id: string; name: string; key: string; kind: string };
type Driver = {
  id: string;
  displayName: string;
  status: string;
  phoneMasked: string;
  carrierId?: string;
};
type Vehicle = {
  id: string;
  registration: string;
  equipmentType: string;
  status: string;
  carrierId?: string;
};
type Booking = {
  id: string;
  number: string;
  status: string;
  request: { number: string; stops: RequestRow['stops'] };
  legs: Array<{
    id: string;
    sequence: number;
    mode: string;
    status: string;
    assignment?: { id: string };
  }>;
};
type Assignment = {
  id: string;
  status: string;
  nextCheckInAt?: string;
  driver: { displayName: string };
  vehicle: { registration: string };
  leg: { mode: string; booking: { number: string; request: { stops: RequestRow['stops'] } } };
  checkIns: Array<{ id: string; outcome: string; locationText: string; reportedAt: string }>;
  exceptions: Array<{ id: string; code: string; severity: string }>;
};
type Invoice = {
  id: string;
  number: string;
  status: string;
  currency: string;
  totalMinor: number;
  paidMinor: number;
  dueAt: string;
  customerId?: string;
  sourceType: string;
  schedules: Array<{
    sessions: Array<{ id: string; provider: string; status: string; amountMinor: number }>;
  }>;
};

const money = (minor: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(minor) / 100);

export function TransportConsole({ surface }: { surface: 'freight' | 'dispatch' | 'billing' }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!accessToken()) {
      setSignedIn(false);
      return;
    }
    try {
      if (surface === 'freight') {
        const [requestRows, bookingRows] = await Promise.all([
          authenticatedRequest<RequestRow[]>('/freight/operations/requests'),
          authenticatedRequest<Booking[]>('/freight/operations/bookings'),
        ]);
        setRequests(requestRows);
        setBookings(bookingRows);
      } else if (surface === 'dispatch') {
        const [board, carrierRows, driverRows, vehicleRows, bookingRows] = await Promise.all([
          authenticatedRequest<Assignment[]>('/dispatch/board'),
          authenticatedRequest<Carrier[]>('/dispatch/carriers'),
          authenticatedRequest<Driver[]>('/dispatch/drivers'),
          authenticatedRequest<Vehicle[]>('/dispatch/vehicles'),
          authenticatedRequest<Booking[]>('/freight/operations/bookings'),
        ]);
        setAssignments(board);
        setCarriers(carrierRows);
        setDrivers(driverRows);
        setVehicles(vehicleRows);
        setBookings(bookingRows);
      } else {
        setInvoices(await authenticatedRequest<Invoice[]>('/billing/operations/invoices'));
      }
      setSignedIn(true);
    } catch (error) {
      setSignedIn(true);
      setMessage(error instanceof Error ? error.message : 'Operations data could not be loaded.');
    }
  }, [surface]);

  useEffect(() => void load(), [load]);

  async function action(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage('');
    try {
      await work();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function quote(event: FormEvent<HTMLFormElement>, request: RequestRow) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Math.round(Number(form.get('amount')) * 100);
    await action(async () => {
      const created = await authenticatedRequest<{ id: string }>(
        `/freight/operations/requests/${request.id}/quotes`,
        {
          method: 'POST',
          body: JSON.stringify({
            currency: 'USD',
            taxMinor: 0,
            paymentPolicy: form.get('paymentPolicy'),
            ...(form.get('paymentPolicy') === 'DEPOSIT'
              ? { depositPercent: Number(form.get('depositPercent')) }
              : {}),
            paymentTermsDays: form.get('paymentPolicy') === 'NET_TERMS' ? 30 : 0,
            validUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(),
            lines: [
              {
                kind: 'FREIGHT_SERVICE',
                description: `${request.preferredModes.join('/')} transportation ${request.stops.map((stop) => stop.city).join(' to ')}`,
                quantity: 1,
                unitMinor: amount,
              },
            ],
          }),
        },
      );
      return authenticatedRequest(`/freight/operations/quotes/${created.id}/publish`, {
        method: 'POST',
      });
    }, 'Binding quote published to the customer.');
  }

  async function addLeg(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const booking = bookings.find(({ id }) => id === form.get('bookingId'));
    if (!booking || booking.request.stops.length < 2) return;
    await action(
      () =>
        authenticatedRequest(`/freight/operations/bookings/${booking.id}/legs`, {
          method: 'POST',
          body: JSON.stringify({
            sequence: booking.legs.length + 1,
            mode: form.get('mode'),
            originStopId: booking.request.stops[0]?.id,
            destinationStopId: booking.request.stops.at(-1)?.id,
            ...(form.get('carrierId') ? { carrierId: form.get('carrierId') } : {}),
          }),
        }),
      'Transport leg added.',
    );
  }

  async function createCarrier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(
      () =>
        authenticatedRequest('/dispatch/carriers', {
          method: 'POST',
          body: JSON.stringify({
            key: form.get('key'),
            name: form.get('name'),
            kind: form.get('kind'),
            modes: ['ROAD'],
          }),
        }),
      'Carrier created.',
    );
  }

  async function createDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(
      () =>
        authenticatedRequest('/dispatch/drivers', {
          method: 'POST',
          body: JSON.stringify({
            displayName: form.get('displayName'),
            phone: form.get('phone'),
            ...(form.get('carrierId') ? { carrierId: form.get('carrierId') } : {}),
          }),
        }),
      'Driver created with encrypted contact details.',
    );
  }

  async function createVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(
      () =>
        authenticatedRequest('/dispatch/vehicles', {
          method: 'POST',
          body: JSON.stringify({
            registration: form.get('registration'),
            equipmentType: form.get('equipmentType'),
            ...(form.get('carrierId') ? { carrierId: form.get('carrierId') } : {}),
          }),
        }),
      'Vehicle created.',
    );
  }

  const unassignedRoadLegs = useMemo(
    () =>
      bookings.flatMap((booking) =>
        booking.legs
          .filter((leg) => leg.mode === 'ROAD' && !leg.assignment)
          .map((leg) => ({ ...leg, bookingNumber: booking.number })),
      ),
    [bookings],
  );

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const driver = drivers.find(({ id }) => id === form.get('driverId'));
    const vehicle = vehicles.find(({ id }) => id === form.get('vehicleId'));
    await action(
      () =>
        authenticatedRequest(`/dispatch/legs/${formText(form, 'legId')}/assignments`, {
          method: 'POST',
          body: JSON.stringify({
            driverId: form.get('driverId'),
            vehicleId: form.get('vehicleId'),
            ...(driver?.carrierId && driver.carrierId === vehicle?.carrierId
              ? { carrierId: driver.carrierId }
              : {}),
            checkInIntervalMinutes: 240,
          }),
        }),
      'Road assignment created.',
    );
  }

  async function checkIn(event: FormEvent<HTMLFormElement>, assignment: Assignment) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(
      () =>
        authenticatedRequest(`/dispatch/assignments/${assignment.id}/check-ins`, {
          method: 'POST',
          body: JSON.stringify({
            source: form.get('source'),
            outcome: form.get('outcome'),
            locationText: form.get('locationText'),
            reportedAt: new Date().toISOString(),
            note: form.get('note') || undefined,
            externalKey: crypto.randomUUID(),
          }),
        }),
      'Manual driver check-in recorded.',
    );
  }

  async function refund(invoice: Invoice) {
    const session = invoice.schedules
      .flatMap((schedule) => schedule.sessions)
      .find(({ status }) => status === 'COMPLETED');
    if (!session) return;
    await action(
      () =>
        authenticatedRequest(`/billing/operations/payments/${session.id}/refunds`, {
          method: 'POST',
          body: JSON.stringify({
            amountMinor: Math.min(session.amountMinor, invoice.paidMinor),
            reason: 'Operations-approved customer refund',
          }),
        }),
      'Refund submitted and invoice balance updated.',
    );
  }

  const titles = {
    freight: [
      'Freight operations',
      'Review customer demand, publish binding quotes, and plan multimodal legs.',
    ],
    dispatch: [
      'Driver coordination',
      'Assign road resources, call drivers, and keep location evidence current.',
    ],
    billing: [
      'Billing operations',
      'Monitor invoices, provider payments, overdue balances, and refunds.',
    ],
  } as const;

  return (
    <main id="main" className="app-page operations-console">
      <AppHeader active="operations" />
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations workspace</p>
          <h1>{titles[surface][0]}</h1>
          <p className="page-subtitle">{titles[surface][1]}</p>
        </div>
        <nav className="console-tabs" aria-label="Transportation operations">
          <a className={surface === 'freight' ? 'is-active' : ''} href="/operations/freight">
            Freight
          </a>
          <a className={surface === 'dispatch' ? 'is-active' : ''} href="/operations/dispatch">
            Dispatch
          </a>
          <a className={surface === 'billing' ? 'is-active' : ''} href="/operations/billing">
            Billing
          </a>
          <a href="/operations/network">Network</a>
          <a href="/operations/insurance">Insurance</a>
          <a href="/operations/postal">Postal</a>
        </nav>
      </div>
      {signedIn === false ? (
        <section className="auth-gate">
          <div>
            <h2>Operations sign-in required.</h2>
            <p>Your assigned permissions determine the queues and actions available here.</p>
          </div>
          <a className="button button--primary" href="/account">
            Go to account
          </a>
        </section>
      ) : null}
      {message ? (
        <p className="freight-notice" role="status">
          {message}
        </p>
      ) : null}

      {signedIn && surface === 'freight' ? (
        <div className="console-grid">
          <section className="report-panel span-2">
            <div className="report-heading">
              <div>
                <h2>Request review queue</h2>
                <p>{requests.length} freight requests</p>
              </div>
            </div>
            <div className="operations-list">
              {requests.map((request) => (
                <article key={request.id}>
                  <div>
                    <span className="status-word">
                      {request.status.replaceAll('_', ' ').toLowerCase()}
                    </span>
                    <h3>{request.number}</h3>
                    <p>
                      {request.stops.map((stop) => `${stop.city}, ${stop.countryCode}`).join(' → ')}
                    </p>
                    <small>{request.cargoItems.map((cargo) => cargo.description).join(', ')}</small>
                  </div>
                  <div className="operator-actions">
                    <button
                      disabled={
                        busy || !['SUBMITTED', 'UNDER_REVIEW', 'QUOTED'].includes(request.status)
                      }
                      onClick={() =>
                        void action(
                          () =>
                            authenticatedRequest(
                              `/freight/operations/requests/${request.id}/estimate`,
                              { method: 'POST' },
                            ),
                          'Estimate recalculated.',
                        )
                      }
                    >
                      Calculate estimate
                    </button>
                    <form onSubmit={(event) => void quote(event, request)}>
                      <label>
                        <span>Binding total (USD)</span>
                        <input
                          name="amount"
                          type="number"
                          min="1"
                          step="0.01"
                          defaultValue={Number(request.estimates[0]?.totalMinor ?? 0) / 100 || 1000}
                          required
                        />
                      </label>
                      <label>
                        <span>Payment</span>
                        <select name="paymentPolicy">
                          <option>PREPAY</option>
                          <option>DEPOSIT</option>
                          <option>NET_TERMS</option>
                        </select>
                      </label>
                      <label>
                        <span>Deposit %</span>
                        <input
                          name="depositPercent"
                          type="number"
                          min="1"
                          max="99"
                          defaultValue="30"
                        />
                      </label>
                      <button className="button button--primary" disabled={busy}>
                        Publish quote
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Plan a transport leg</h2>
                <p>Build the accepted booking’s route.</p>
              </div>
            </div>
            <form className="stack-form" onSubmit={(event) => void addLeg(event)}>
              <label>
                <span>Booking</span>
                <select name="bookingId" required>
                  {bookings
                    .filter(({ status }) => ['CONFIRMED', 'PLANNED'].includes(status))
                    .map((booking) => (
                      <option value={booking.id} key={booking.id}>
                        {booking.number}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Mode</span>
                <select name="mode">
                  <option>ROAD</option>
                  <option>SEA</option>
                  <option>AIR</option>
                  <option>RAIL</option>
                </select>
              </label>
              <label>
                <span>Carrier</span>
                <select name="carrierId">
                  <option value="">Assign later</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={busy}>Add leg</button>
            </form>
          </section>
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Accepted bookings</h2>
                <p>Payment and planning state</p>
              </div>
            </div>
            <div className="compact-list">
              {bookings.map((booking) => (
                <div key={booking.id}>
                  <span>{booking.number}</span>
                  <strong>{booking.status.replaceAll('_', ' ').toLowerCase()}</strong>
                  <small>{booking.legs.length} legs</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {signedIn && surface === 'dispatch' ? (
        <div className="console-grid">
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Carrier</h2>
                <p>Internal or subcontracted</p>
              </div>
            </div>
            <form className="stack-form" onSubmit={(event) => void createCarrier(event)}>
              <input name="key" required placeholder="carrier-key" />
              <input name="name" required placeholder="Carrier name" />
              <select name="kind">
                <option>SUBCONTRACTED</option>
                <option>INTERNAL</option>
              </select>
              <button disabled={busy}>Add carrier</button>
            </form>
          </section>
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Driver</h2>
                <p>Phone details are encrypted</p>
              </div>
            </div>
            <form className="stack-form" onSubmit={(event) => void createDriver(event)}>
              <input name="displayName" required placeholder="Driver name" />
              <input name="phone" required placeholder="+1 555 0100" />
              <select name="carrierId">
                <option value="">Internal</option>
                {carriers.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </option>
                ))}
              </select>
              <button disabled={busy}>Add driver</button>
            </form>
          </section>
          <section className="report-panel">
            <div className="report-heading">
              <div>
                <h2>Vehicle</h2>
                <p>Road equipment registry</p>
              </div>
            </div>
            <form className="stack-form" onSubmit={(event) => void createVehicle(event)}>
              <input name="registration" required placeholder="Registration" />
              <input name="equipmentType" required placeholder="TRACTOR_TRAILER" />
              <select name="carrierId">
                <option value="">Internal</option>
                {carriers.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </option>
                ))}
              </select>
              <button disabled={busy}>Add vehicle</button>
            </form>
          </section>
          <section className="report-panel span-2">
            <div className="report-heading">
              <div>
                <h2>Assign a road leg</h2>
                <p>{unassignedRoadLegs.length} legs awaiting resources</p>
              </div>
            </div>
            <form className="inline-form" onSubmit={(event) => void assign(event)}>
              <select name="legId" required>
                {unassignedRoadLegs.map((leg) => (
                  <option key={leg.id} value={leg.id}>
                    {leg.bookingNumber} · leg {leg.sequence}
                  </option>
                ))}
              </select>
              <select name="driverId" required>
                {drivers
                  .filter(({ status }) => status === 'AVAILABLE')
                  .map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.displayName} · {driver.phoneMasked}
                    </option>
                  ))}
              </select>
              <select name="vehicleId" required>
                {vehicles
                  .filter(({ status }) => status === 'AVAILABLE')
                  .map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration}
                    </option>
                  ))}
              </select>
              <button disabled={busy}>Assign</button>
            </form>
          </section>
          <section className="report-panel span-2">
            <div className="report-heading">
              <div>
                <h2>Active driver contacts</h2>
                <p>Location evidence and overdue check-ins</p>
              </div>
            </div>
            <div className="operations-list">
              {assignments.map((assignment) => (
                <article key={assignment.id}>
                  <div>
                    <span className="status-word">{assignment.status.toLowerCase()}</span>
                    <h3>
                      {assignment.leg.booking.number} · {assignment.driver.displayName}
                    </h3>
                    <p>
                      {assignment.vehicle.registration} ·{' '}
                      {assignment.leg.booking.request.stops.map((stop) => stop.city).join(' → ')}
                    </p>
                    {assignment.nextCheckInAt ? (
                      <small>
                        Next contact {new Date(assignment.nextCheckInAt).toLocaleString()}
                      </small>
                    ) : null}
                    {assignment.exceptions.map((exception) => (
                      <strong className="text-risk" key={exception.id}>
                        {exception.code.replaceAll('_', ' ').toLowerCase()}
                      </strong>
                    ))}
                  </div>
                  <div className="operator-actions">
                    {assignment.status === 'ASSIGNED' ? (
                      <button
                        onClick={() =>
                          void action(
                            () =>
                              authenticatedRequest(
                                `/dispatch/assignments/${assignment.id}/transition`,
                                { method: 'POST', body: JSON.stringify({ action: 'START' }) },
                              ),
                            'Assignment started.',
                          )
                        }
                      >
                        Start trip
                      </button>
                    ) : null}
                    {assignment.status === 'IN_TRANSIT' ? (
                      <form onSubmit={(event) => void checkIn(event, assignment)}>
                        <label>
                          <span>Location reported</span>
                          <input
                            name="locationText"
                            required
                            placeholder="Near city / checkpoint"
                          />
                        </label>
                        <label>
                          <span>Contact method</span>
                          <select name="source">
                            <option>PHONE</option>
                            <option>WHATSAPP</option>
                            <option>SMS</option>
                            <option>MANUAL</option>
                          </select>
                        </label>
                        <label>
                          <span>Outcome</span>
                          <select name="outcome">
                            <option>REACHED</option>
                            <option>NO_ANSWER</option>
                            <option>DELAY</option>
                            <option>EXCEPTION</option>
                          </select>
                        </label>
                        <input name="note" placeholder="Coordinator note" />
                        <button className="button button--primary" disabled={busy}>
                          Record check-in
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {signedIn && surface === 'billing' ? (
        <section className="report-panel">
          <div className="report-heading">
            <div>
              <h2>Canonical invoices</h2>
              <p>Commerce, B2B, 3PL, and freight receivables in one queue</p>
            </div>
          </div>
          <div className="exception-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.number}</td>
                    <td>{invoice.sourceType.replaceAll('_', ' ').toLowerCase()}</td>
                    <td>
                      <span className="status-word">
                        {invoice.status.replaceAll('_', ' ').toLowerCase()}
                      </span>
                    </td>
                    <td>{new Date(invoice.dueAt).toLocaleDateString()}</td>
                    <td>{money(invoice.totalMinor, invoice.currency)}</td>
                    <td>{money(invoice.paidMinor, invoice.currency)}</td>
                    <td>
                      {invoice.paidMinor > 0 ? (
                        <button disabled={busy} onClick={() => void refund(invoice)}>
                          Refund payment
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
