/* Copyright (C) Eelco Vriezekolk, Agentschap Telecom.
 * See LICENSE.md
 */

/* globals autoSaveFunction, setModified
*/


/* createUUID: return a new "unique" random UUID.
 * There are different UUID-versions; version 4 is randomly generated.
 * Use the crypto library, as Math.random() is insufficiently random.
 */
function createUUID() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)  // eslint-disable-line no-bitwise
  );
}

function transactionCompleted(/*transaction*/) {
#ifdef SERVER
	autoSaveFunction();
#else
	setModified();
#endif
}

