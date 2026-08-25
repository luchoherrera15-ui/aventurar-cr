Namespace Options

    ''' <summary>
    ''' Configuración de la integración con WhatsApp Cloud API (Meta).
    ''' Se enlaza desde la sección "WhatsApp" de appsettings.json / variables de entorno.
    ''' </summary>
    Public Class WhatsAppOptions

        Public Const SeccionConfiguracion As String = "WhatsApp"

        ''' <summary>ID del número de teléfono de WhatsApp Business (Phone Number ID de Meta).</summary>
        Public Property PhoneNumberId As String = String.Empty

        ''' <summary>Access token permanente del usuario del sistema. Viene de una variable de entorno, nunca hardcodeado.</summary>
        Public Property AccessToken As String = String.Empty

        ''' <summary>
        ''' Token que Meta debe enviar en "hub.verify_token" al verificar el webhook.
        ''' Es el mismo valor que se copia al panel de Meta (Configuración de Webhooks).
        ''' </summary>
        Public Property VerifyToken As String = String.Empty

    End Class

End Namespace
