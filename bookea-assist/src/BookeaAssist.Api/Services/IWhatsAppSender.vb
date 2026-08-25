Namespace Services

    ''' <summary>Envía mensajes salientes de WhatsApp a través de la Cloud API de Meta.</summary>
    Public Interface IWhatsAppSender

        ''' <summary>Envía un mensaje de texto simple al número indicado (formato E.164 sin "+", ej. "50688887777").</summary>
        Function EnviarTextoAsync(numeroDestino As String, texto As String) As Task

    End Interface

End Namespace
