// Command vapidkeys prints a new VAPID key pair for Web Push, in the form
// .env expects. Run it once per deployment and keep the result: replacing the
// keys makes every phone's existing subscription stop receiving pushes.
package main

import (
	"fmt"
	"log"

	webpush "github.com/SherClockHolmes/webpush-go"
)

func main() {
	privateKey, publicKey, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n", publicKey, privateKey)
}
