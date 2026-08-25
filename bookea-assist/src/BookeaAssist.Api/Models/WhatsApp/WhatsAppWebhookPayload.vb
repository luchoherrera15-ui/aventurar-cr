Namespace Models.WhatsApp

    ''' <summary>Cuerpo completo que Meta envía al POST /webhook.</summary>
    Public Class WhatsAppWebhookPayload

        <JsonPropertyName("object")>
        Public Property TipoObjeto As String = String.Empty

        <JsonPropertyName("entry")>
        Public Property Entradas As List(Of WhatsAppEntrada) = New List(Of WhatsAppEntrada)()

    End Class

    Public Class WhatsAppEntrada

        <JsonPropertyName("id")>
        Public Property Id As String = String.Empty

        <JsonPropertyName("changes")>
        Public Property Cambios As List(Of WhatsAppCambio) = New List(Of WhatsAppCambio)()

    End Class

    Public Class WhatsAppCambio

        <JsonPropertyName("value")>
        Public Property Valor As WhatsAppValor

        <JsonPropertyName("field")>
        Public Property Campo As String = String.Empty

    End Class

    Public Class WhatsAppValor

        <JsonPropertyName("messaging_product")>
        Public Property ProductoMensajeria As String = String.Empty

        <JsonPropertyName("metadata")>
        Public Property Metadata As WhatsAppMetadata

        <JsonPropertyName("contacts")>
        Public Property Contactos As List(Of WhatsAppContacto)

        ''' <summary>Mensajes entrantes del cliente. Ausente cuando el "change" es de otro tipo (ej. "statuses").</summary>
        <JsonPropertyName("messages")>
        Public Property Mensajes As List(Of WhatsAppMensajeEntrante)

    End Class

    Public Class WhatsAppMetadata

        <JsonPropertyName("display_phone_number")>
        Public Property NumeroTelefonoVisible As String = String.Empty

        <JsonPropertyName("phone_number_id")>
        Public Property PhoneNumberId As String = String.Empty

    End Class

    Public Class WhatsAppContacto

        <JsonPropertyName("wa_id")>
        Public Property WaId As String = String.Empty

        <JsonPropertyName("profile")>
        Public Property Perfil As WhatsAppPerfil

    End Class

    Public Class WhatsAppPerfil

        <JsonPropertyName("name")>
        Public Property Nombre As String = String.Empty

    End Class

    Public Class WhatsAppMensajeEntrante

        <JsonPropertyName("from")>
        Public Property De As String = String.Empty

        <JsonPropertyName("id")>
        Public Property Id As String = String.Empty

        <JsonPropertyName("timestamp")>
        Public Property Timestamp As String = String.Empty

        ''' <summary>"text", "image", "interactive", etc. Por ahora solo procesamos "text".</summary>
        <JsonPropertyName("type")>
        Public Property Tipo As String = String.Empty

        <JsonPropertyName("text")>
        Public Property Texto As WhatsAppTextoBody

    End Class

    Public Class WhatsAppTextoBody

        <JsonPropertyName("body")>
        Public Property Body As String = String.Empty

    End Class

End Namespace
