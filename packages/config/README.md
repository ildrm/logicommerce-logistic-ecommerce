# @logicommerce/config

Fail-fast environment validation shared by API and worker processes.

Payment, object-storage, signing, encryption, and public URL settings are
validated centrally. `PAYMENT_ADAPTER=mock` fails closed in production;
declaring SMTP or a scanner setting does not by itself provide that adapter.
