# Tannenbaumbiel

Tannenbaumbiel ist ein Browser spiel das primär für mobile Endgeräte entwickelt wird.

## Technik

Es gibt ein python backend welches als (dedicated) game server fungiert. Über dieses backend können sich spieler anmelden und alleine oder zu mehreren Spielern in der Selben Welt spielen. Spieler melden sich mit einem Nutzername und dem Namen der Welt in der sie spielen möchten an. Darauf hin sendet der Server die Spieldaten, d.h. den Zustand der Welt in der nähe des Spielers per websocket Verbindung an das frontend und erhält die Steuerbefehle zur Bewegung der Spielfigur vom Frontend.
Performance ist entscheidend für ein flüssiges Spielerlebnis, dem entsprechend wird die verwendete Technologie/framework ausgewählt.

Das frontend basiert auf einem modernen java script framework für 2d spiele. Wichtig ist auch hier eine performante Darstellung der schnell wechselnden spielwelt und flüssige steuerung der spielfigur mittels einfacher touch Gesten.

## Grafische Gestaltung

Die Spielgrafik erinnert an frühe Disneyfilme, d.h. Kino Zeichentrick aus den 1930er Jahren.

## Inhalt

Bei dem Spiel handelt es sich im Kern um einen einfachen Platformer/2d Shooter, im Spielprinzip ähnlich wie z.B. Super Mario.

Der kann sich nach links und rechts laufend vorwärts bewegen, fällt bis zur nächsten Plattform hinunter und kann, wenn er aktuell Boden berührt, springen. Weiterhin kann der Spieler magische kugelblitze aus seinem Zauberstab schießen.

Der Spieler kann am Anfang aus einer reihe von Spielfiguren wählen. Zunächst stehen 3 Spielfiguren zur Auswahl. Bei der Gestaltung orientieren wir uns an den Sprites unter `/free-pixel-art-tiny-hero-sprites`.

Wir implementieren zunächst nur eine Welt. Später können auch andere Welten gestartet werden.
Die Welt ist ein verzauberter Winterwald. Hier wird man von Schneemännern angegriffen, die Schneebälle auf den Spieler werfen. Am Ende erreicht der Spieler ein Übermäßig mit Girlanden und Lichtern dekoriertes Haus im Wald im US Amerikanischen Stiel.

Der Endgegner der ersten Welt ist ein riesiger Tannenbaum im Wohnzimmer des Hauses. Er schießt kleine Tannenbaumkugeln ab, welche autonom als relativ einfache Gegner agieren und besiegt werden müssen.
